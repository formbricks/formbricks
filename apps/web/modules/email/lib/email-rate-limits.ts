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
   * The user whose action caused the email: the signed-in user, or the owner of the survey or workflow that
   * sent it (`resolveEmailActorUserId`). Never a value a request body sets. Counted across every organization
   * they belong to, so creating a fresh organization does not reset it.
   */
  actorUserId?: string | null;
  /**
   * The recipient is not one of the organization's members: an address a respondent, visitor or author typed
   * in. Only such email counts against the limits respondents can drive.
   */
  externalRecipient?: boolean;
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
  };
  /** Counted together with the other types of the same group, so moving mail between them gains nothing. */
  group?: string;
  /**
   * Only email to an external recipient is counted. Mail to the organization's own members is its own
   * business, and the respondents who trigger it must not be able to use up its budget.
   */
  externalOnly?: boolean;
};

const limit = (allowedPerInterval: number, interval = HOUR): TLimit => ({ allowedPerInterval, interval });

/**
 * Email a survey or workflow sends to an address someone typed in: a respondent's answer, a visitor's
 * verification request, or an author's literal address outside the organization. One budget for all three
 * types: 200 an hour per organization, 300 per owner, and 5 an hour to one inbox from one organization.
 *
 * No per-deployment cap: anonymous respondents drive this email, so a shared cap would let them stop it for
 * every organization at once. The per-owner cap is what holds when an attacker opens fresh organizations,
 * and stays below INC-5's ~340 an hour so one owner cannot repeat it. It sits above the organization's cap
 * so that respondents flooding one organization stop there and leave the owner room in their others.
 */
const externalSurveyEmail: TEmailRateLimit = {
  group: "survey_external",
  externalOnly: true,
  organization: limit(200),
  actor: limit(300),
  recipient: { inOrganization: limit(5) },
};

/**
 * One entry per email type, so a new type cannot compile until someone has decided its limits.
 *
 * A per-deployment cap is shared by every tenant, so whoever can reach it stops that email for everyone. Only
 * email a signed-in user sends to an address they typed in has one (invites, email changes), set far above
 * what a few accounts can send. Sign-in and account email has none.
 *
 * A per-recipient cap counts one address from one organization, so a sender can neither flood an inbox nor
 * block that person from hearing from anyone else. Only account email, which an address gets from its own
 * account alone, is counted across everyone.
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
  // Six an hour: strangers can ask for three (forgot password, per account) and the signed-in user for three
  // more (profile settings), so neither can use up the other's.
  password_reset: { recipient: { total: limit(6) } },
  password_reset_notification: {},
  account_deletion: {},
  sso_recovery_notification: {},
  sso_sign_in_hint: { recipient: { total: limit(3) } },
  data_retention_notice: {},
  // Sent to the organization's own members; bounds one organization's share of the provider quota.
  response_notification: { organization: limit(2000) },
  survey_preview: { actor: limit(10) },
  customization_preview: { actor: limit(10) },
  verified_survey_link: externalSurveyEmail,
  survey_follow_up: externalSurveyEmail,
  workflow_email: externalSurveyEmail,
};

type TEmailRateLimitScope =
  | "deployment"
  | "organization"
  | "actor"
  | "recipient-in-organization"
  | "recipient";

type TCharge = { scope: TEmailRateLimitScope; config: TRateLimitConfig; identifier: string };

let recipientKey: { source: string; key: Buffer } | undefined;

/**
 * HMAC with a key derived for this purpose only: the identifier reaches Redis keys and the limiter's logs,
 * and an unkeyed hash of an address can be reversed by hashing a list of candidate addresses. Plus and dot
 * variants of one mailbox count separately on purpose: collapsing them would merge distinct people, and the
 * organization and owner caps still bound them.
 */
export const getRecipientIdentifier = (to: string): string => {
  // Derived once per secret rather than once per email.
  if (recipientKey?.source !== ENCRYPTION_KEY) {
    const key = createHmac("sha256", ENCRYPTION_KEY).update("formbricks:email-rate-limit:v1").digest();
    recipientKey = { source: ENCRYPTION_KEY, key };
  }
  return createHmac("sha256", recipientKey.key).update(normalizeEmailForComparison(to)).digest("hex");
};

const requireOrganizationId = (emailType: TEmailType, context: TEmailRateLimitContext): string => {
  if (!context.organizationId) {
    // A sender that forgot its context would otherwise skip the limits that matter most, silently.
    throw new Error(`Sending ${emailType} email requires an organizationId for its rate limits`);
  }
  return context.organizationId;
};

const scaled = ({ allowedPerInterval, interval }: TLimit): TLimit => ({
  allowedPerInterval: Math.max(1, Math.round(allowedPerInterval * EMAIL_RATE_LIMIT_MULTIPLIER)),
  interval,
});

const isCounted = (emailType: TEmailType, context: TEmailRateLimitContext): boolean => {
  if (!emailRateLimits[emailType].externalOnly) {
    return true;
  }
  if (context.externalRecipient === undefined) {
    // Treating a forgotten flag as internal mail would skip every cap on email respondents can drive.
    throw new Error(`Sending ${emailType} email requires externalRecipient for its rate limits`);
  }
  return context.externalRecipient;
};

const getCharges = (emailType: TEmailType, to: string, context: TEmailRateLimitContext): TCharge[] => {
  if (!isCounted(emailType, context)) {
    return [];
  }
  const limits = emailRateLimits[emailType];

  const counter = limits.group ?? emailType;
  const charges: TCharge[] = [];
  const charge = (scope: TEmailRateLimitScope, value: TLimit, identifier: string) => {
    charges.push({ scope, identifier, config: { ...value, namespace: `email:${scope}:${counter}` } });
  };

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
  if (limits.recipient) {
    const recipientId = getRecipientIdentifier(to);
    if (limits.recipient.inOrganization) {
      const organizationId = requireOrganizationId(emailType, context);
      charge(
        "recipient-in-organization",
        limits.recipient.inOrganization,
        `${recipientId}:${organizationId}`
      );
    }
    if (limits.recipient.total) {
      charge("recipient", limits.recipient.total, recipientId);
    }
  }
  if (limits.deployment) {
    charge("deployment", scaled(limits.deployment), "all");
  }
  return charges;
};

/**
 * Charges one email against every limit its type has, all or nothing: when one refuses, the others are
 * handed back, so a refused email costs nothing. Throws `TooManyRequestsError` when a limit is spent. An
 * email that is charged and then fails at the SMTP server keeps its charge, like any other attempt. Like
 * every other limit in the app it fails open when Redis is unavailable, and `RATE_LIMITING_DISABLED` turns
 * it off.
 */
export const applyEmailRateLimits = async (
  emailType: TEmailType,
  to: string,
  context: TEmailRateLimitContext = {}
): Promise<void> => {
  const charges = getCharges(emailType, to, context);
  if (charges.length === 0) {
    return;
  }
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
