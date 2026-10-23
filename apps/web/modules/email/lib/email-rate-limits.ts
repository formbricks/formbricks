import { createHmac } from "node:crypto";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { EMAIL_RATE_LIMIT_MULTIPLIER, ENCRYPTION_KEY } from "@/lib/constants";
import { normalizeEmailForComparison } from "@/lib/utils/email";
import { reserveRateLimitUsage, settleRateLimitUsage } from "@/modules/core/rate-limit/helpers";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import type { TEmailType } from "./send-email";

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Who an email is sent for. Each email type's limits say which of these its sender must supply. */
export type TEmailRateLimitContext = {
  /** The organization the email is sent for. Its cap holds however many workspaces and surveys it has. */
  organizationId?: string;
  /**
   * The user whose action caused the email: the signed-in user, or the owner of the survey or creator of the
   * workflow that sent it. Both are set by the server from the signed-in user, never by a request body. Counted across every organization they belong to, so creating a fresh organization does
   * not reset it. `null` when there is none (a survey created through the API, say); the organization's
   * cap still applies.
   */
  actorUserId?: string | null;
  /** The address came from a respondent's answer rather than from the survey or workflow author. */
  recipientFromResponse?: boolean;
};

type TLimit = { allowedPerInterval: number; interval: number };

type TEmailRateLimit = {
  /** Every email of the type from the deployment. */
  deployment?: TLimit;
  organization?: TLimit;
  actor?: TLimit;
  // The three above count volume and are scaled by `EMAIL_RATE_LIMIT_MULTIPLIER`, for deployments that
  // legitimately send more. Recipient caps protect a person's inbox and never are.
  recipient?: {
    /** One address, from one organization. */
    inOrganization?: TLimit;
    /** One address, from everyone: only for account email, which no other organization sends. */
    total?: TLimit;
    /** Only when the address came from a respondent: authors legitimately mail their own team on every response. */
    onlyWhenFromResponse?: boolean;
  };
};

const limit = (allowedPerInterval: number, interval = HOUR): TLimit => ({ allowedPerInterval, interval });

/**
 * One entry per email type, so a new type cannot compile until someone has decided its limits. The
 * per-organization and per-actor caps are what stop abuse.
 *
 * A per-deployment cap is shared by every tenant, so anyone who can reach it can stop that email for
 * everyone. Only the types that can mail an address someone else typed in have one, as a backstop for spam
 * spread over many accounts, set well above what a few accounts can reach (Cloud sends about 55 emails an
 * hour across every type). Email to the account itself or to an organization's own members has none.
 *
 * A per-recipient cap counts one address from one organization, so a sender can neither flood an inbox nor
 * block that person from hearing from anyone else. Only account email, which an address gets from one
 * account at most, is counted across everyone.
 *
 * Invites are also counted per inviting user and per organization where they are created
 * (`invite-rate-limit.ts`), which counts recipients before an invite exists.
 */
export const emailRateLimits: Record<TEmailType, TEmailRateLimit> = {
  invite: { recipient: { inOrganization: limit(3, DAY) }, deployment: limit(5000, DAY) },
  invite_accepted: {},
  email_verification: { recipient: { total: limit(5) } },
  sso_recovery_verification: { recipient: { total: limit(5) } },
  // Limited to 3 an hour per user where the change is requested. No recipient cap: an address that already
  // has an account is refused silently, so counting only the others would reveal which addresses exist.
  email_change_verification: { deployment: limit(1000) },
  password_reset: { recipient: { total: limit(5) } },
  password_reset_notification: {},
  account_deletion: {},
  sso_recovery_notification: {},
  sso_sign_in_hint: { recipient: { total: limit(3) } },
  data_retention_notice: {},
  response_notification: { organization: limit(2000) },
  survey_preview: { actor: limit(10) },
  customization_preview: { actor: limit(10) },
  // 200 an hour per organization and per sender: below INC-5's ~340, so one sender cannot repeat it.
  verified_survey_link: {
    organization: limit(200),
    actor: limit(200),
    recipient: { inOrganization: limit(3) },
    deployment: limit(3000),
  },
  survey_follow_up: {
    organization: limit(200),
    actor: limit(200),
    recipient: { inOrganization: limit(5), onlyWhenFromResponse: true },
    deployment: limit(5000),
  },
  workflow_email: {
    organization: limit(200),
    actor: limit(200),
    recipient: { inOrganization: limit(5), onlyWhenFromResponse: true },
    deployment: limit(5000),
  },
};

type TEmailRateLimitScope =
  | "deployment"
  | "organization"
  | "actor"
  | "recipient-in-organization"
  | "recipient";

type TCharge = { scope: TEmailRateLimitScope; config: TRateLimitConfig; identifier: string };

const toConfig = (emailType: TEmailType, scope: TEmailRateLimitScope, value: TLimit): TRateLimitConfig => ({
  ...value,
  namespace: `email:${scope}:${emailType}`,
});

/**
 * HMAC with a key derived for this purpose only: the identifier reaches Redis keys and the limiter's
 * logs, and an unkeyed hash of an address can be reversed by hashing a list of candidate addresses.
 */
export const getRecipientIdentifier = (to: string): string => {
  const key = createHmac("sha256", ENCRYPTION_KEY).update("formbricks:email-rate-limit:v1").digest();
  return createHmac("sha256", key).update(normalizeEmailForComparison(to)).digest("hex");
};

const requireOrganizationId = (emailType: TEmailType, context: TEmailRateLimitContext): string => {
  if (!context.organizationId) {
    // A sender that forgot its context would otherwise skip the limits that matter most, silently.
    throw new Error(`Sending ${emailType} email requires an organizationId for its rate limits`);
  }
  return context.organizationId;
};

const getCharges = (emailType: TEmailType, to: string, context: TEmailRateLimitContext): TCharge[] => {
  const limits = emailRateLimits[emailType];
  const charges: TCharge[] = [];
  const charge = (scope: TEmailRateLimitScope, value: TLimit, identifier: string) => {
    charges.push({ scope, config: toConfig(emailType, scope, value), identifier });
  };
  const scaled = ({ allowedPerInterval, interval }: TLimit): TLimit => ({
    allowedPerInterval: Math.max(1, Math.round(allowedPerInterval * EMAIL_RATE_LIMIT_MULTIPLIER)),
    interval,
  });

  if (limits.organization) {
    charge("organization", scaled(limits.organization), requireOrganizationId(emailType, context));
  }
  if (limits.actor) {
    if (context.actorUserId === undefined) {
      throw new Error(`Sending ${emailType} email requires an actorUserId (or null) for its rate limits`);
    }
    if (context.actorUserId) {
      charge("actor", scaled(limits.actor), context.actorUserId);
    }
  }

  const { recipient } = limits;
  if (recipient && (!recipient.onlyWhenFromResponse || context.recipientFromResponse)) {
    const recipientId = getRecipientIdentifier(to);
    if (recipient.inOrganization) {
      const organizationId = requireOrganizationId(emailType, context);
      charge("recipient-in-organization", recipient.inOrganization, `${recipientId}:${organizationId}`);
    }
    if (recipient.total) {
      charge("recipient", recipient.total, recipientId);
    }
  }

  if (limits.deployment) {
    charge("deployment", scaled(limits.deployment), "all");
  }
  return charges;
};

/**
 * Charges one email against every limit its type has, all or nothing: when one refuses, the others are
 * handed back, so a refused email costs nothing. Throws `TooManyRequestsError` when a limit is spent. Like
 * every other limit in the app it fails open when Redis is unavailable, and `RATE_LIMITING_DISABLED`
 * turns it off.
 */
export const applyEmailRateLimits = async (
  emailType: TEmailType,
  to: string,
  context: TEmailRateLimitContext = {}
): Promise<void> => {
  const charges = getCharges(emailType, to, context);
  const results = await Promise.allSettled(
    charges.map((charge) => reserveRateLimitUsage(charge.config, charge.identifier))
  );

  const refusedIndex = results.findIndex((result) => result.status === "rejected");
  if (refusedIndex === -1) {
    return;
  }

  await Promise.all(
    results.map((result) =>
      result.status === "fulfilled" ? settleRateLimitUsage(result.value, 0) : Promise.resolve()
    )
  );

  const { reason } = results[refusedIndex] as PromiseRejectedResult;
  if (reason instanceof TooManyRequestsError) {
    const { scope, config } = charges[refusedIndex];
    // The type and the limit only: never the address, which is the one thing this must not log.
    logger.warn(
      {
        emailType,
        scope,
        namespace: config.namespace,
        limit: config.allowedPerInterval,
        window: config.interval,
      },
      "Outbound email suppressed: rate limit reached"
    );
  }
  throw reason;
};
