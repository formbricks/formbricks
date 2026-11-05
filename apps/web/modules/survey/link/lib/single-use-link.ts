import "server-only";
import { createHash } from "node:crypto";
import { cache as reactCache } from "react";
import { logger } from "@formbricks/logger";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  type TSurveySingleUseLinkValidation,
  validateSurveySingleUseLinkParams,
} from "@/lib/utils/single-use-surveys";
import { type TSingleUseLinkSurface, recordSingleUseLinkValidation } from "./single-use-link-metrics";

/**
 * A grouping key for one presented `suToken`, never the token itself. Mirrors the `stateHash` in
 * `lib/oauth/integration-state.ts`, which also reaches for `createHash` directly rather than the
 * `hashSha256` helper marked "for legacy support".
 *
 * Taken over the token and deliberately **not** over the `suId`. The token is a 256-bit HMAC output,
 * so a truncated SHA-256 of it is not dictionary-attackable. A custom `suId` is operator-chosen and
 * routinely low-entropy ("CUSTOMER-4711"), so any unkeyed hash of it is trivially reversed and would
 * leak the operator's customer numbering to anyone who can read the logs.
 */
const fingerprintSuToken = (suToken: string): string =>
  createHash("sha256").update(suToken).digest("hex").slice(0, 12);

/** A single-use link value as it arrives from the URL: repeated parameters come back as an array. */
export type TSingleUseSearchParam = string | string[] | null;

/**
 * Next's App Router hands back `string[]` for a repeated query parameter, and the page surfaces read
 * these straight off `searchParams`. `TLinkSurveySearchParams` types them as `string`, but its
 * `Record<string, string | string[] | undefined>` index signature means the intersection still reports
 * `string | undefined`, so the compiler cannot catch it. Coerce here rather than at each caller: an
 * array reaching the validator throws on `.trim()`, and one reaching `createHash` throws
 * ERR_INVALID_ARG_TYPE, which would turn `?suToken=a&suToken=b` into a 500 plus a Sentry event that any
 * anonymous caller could repeat at will.
 */
export const singleSearchParamValue = (value?: TSingleUseSearchParam): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * The one place that turns a link survey's URL parameters into a canonical single-use id.
 *
 * Single implementation on purpose, mirroring `enforceVerifiedEmailGate` and
 * `verifyResponseRecaptcha`: the same check enforced independently in several places is the drift
 * that produced ENG-2758. The renderer had its own encrypted branch that called a validator taking
 * no `surveyId` at all, so an encrypted link minted for one survey opened any other survey on the
 * deployment — across organisations on Cloud, where one ENCRYPTION_KEY serves every tenant.
 *
 * Owning the single `symmetricDecrypt` here is part of that: three call sites previously passed
 * three different decrypt callbacks, one of which collapsed "could not decrypt" and "not a cuid"
 * into the same value.
 *
 * Never logs the raw `suToken`, the raw `suId`, the decrypted id, or the request URL — and there is
 * no safety net if that slips: `redactPII` matches its `SENSITIVE_KEYS` by exact lowercase key
 * equality, so a field named `suToken` would not be redacted, and the logger does not apply it by
 * default.
 *
 * @returns the canonical single-use id to record against a response, or `null` when the link is not
 *   valid for this survey.
 */
export const resolveSingleUseIdForSurvey = ({
  surveyId,
  isEncrypted,
  suId,
  suToken,
  surface,
}: {
  surveyId: string;
  isEncrypted: boolean;
  suId?: TSingleUseSearchParam;
  suToken?: TSingleUseSearchParam;
  surface: TSingleUseLinkSurface;
}): string | null => {
  const mode = isEncrypted ? "encrypted" : "plaintext";

  const rawSuId = singleSearchParamValue(suId);
  const rawSuToken = singleSearchParamValue(suToken);

  let result: TSurveySingleUseLinkValidation;
  try {
    result = validateSurveySingleUseLinkParams({
      surveyId,
      suId: rawSuId,
      suToken: rawSuToken,
      isEncrypted,
      decrypt: (encryptedSingleUseId) => symmetricDecrypt(encryptedSingleUseId, ENCRYPTION_KEY),
    });
  } catch (error) {
    // Reachable only when ENCRYPTION_KEY is unset or empty, which the signing helper throws on. The
    // v1 endpoint answers 500 for that before it reaches here; v2 has no such check and the page
    // renderer has none either, so this has to fail closed rather than render the survey.
    //
    // `err`, not `error`: the logger registers pino's serializer for that key only, and an Error
    // under any other key serializes to `{}` — message and stack are non-enumerable.
    logger.error({ err: error, surveyId, surface }, "Single-use link validation failed unexpectedly");
    recordSingleUseLinkValidation({ mode, outcome: "rejected", reason: "internal_error", surface });
    return null;
  }

  if (!result.ok) {
    // warn, not error: on a public endpoint an absent or wrong token is an ordinary
    // caller-controlled condition rather than an application fault, and erroring on it hands any
    // anonymous caller a lever to flood the error log — the rule stated in
    // modules/api/lib/verify-response-recaptcha.ts.
    //
    // The fingerprint is computed only here, on the rejection path, and only when a token was
    // actually presented. Its absence is itself the signal that separates a link minted before this
    // release from a forgery; when present, it separates one broken email template retried 10,000
    // times from 10,000 distinct forgeries.
    //
    // `missing_su_id` is counted but not logged. It fires on any request to a single-use survey's
    // public URL that carries no `suId` at all — a crawler on `/s/{surveyId}`, the bare link pasted
    // into a chat — which is the same anonymous-caller flooding lever, one level down, and on `main`
    // this case returned null silently. It is also the least actionable of the reasons: the
    // post-upgrade diagnostic an operator needs is `missing_signature`, whose volume is bounded by
    // how many pre-release links were mailed. The counter still carries it, so the volume remains
    // visible without a log line per crawl.
    if (result.reason !== "missing_su_id") {
      logger.warn(
        {
          surveyId,
          surface,
          mode,
          reason: result.reason,
          ...(rawSuToken ? { suTokenFingerprint: fingerprintSuToken(rawSuToken) } : {}),
        },
        "Rejected single-use survey link"
      );
    }

    recordSingleUseLinkValidation({ mode, outcome: "rejected", reason: result.reason, surface });
    return null;
  }

  if (result.legacyUnsigned) {
    // warn, not info: the deployment has just accepted a credential bound to no survey, because
    // SINGLE_USE_LEGACY_UNSIGNED_UNTIL is set. Unlike the rejection warns above, this one is bounded
    // by how many pre-release links are still circulating rather than by anonymous traffic, so it is
    // not a flooding lever — and it is the only record that the window is doing anything. Carries
    // the expiry so the line answers "how long does this keep happening" on its own.
    logger.warn(
      { surveyId, surface, legacyUnsignedUntil: env.SINGLE_USE_LEGACY_UNSIGNED_UNTIL },
      "Accepted an unsigned legacy single-use link under SINGLE_USE_LEGACY_UNSIGNED_UNTIL"
    );
  }

  recordSingleUseLinkValidation({
    mode,
    outcome: "accepted",
    reason: result.legacyUnsigned ? "legacy_unsigned" : "none",
    surface,
  });
  return result.singleUseId;
};

/**
 * Resolved once per render. The link page and its `generateMetadata` ask the same question about the same
 * URL, and resolving it twice would count one rejected link twice and log it twice — the metric and the
 * warn line are how an operator tells an enumeration from a broken email template. `cache` only dedupes
 * within one React render, which is all that case needs: a server action isn't a render, so it may not share
 * it, but it resolves the link once per call, so each attempt still counts once. Primitive arguments only,
 * because `cache` compares them by identity.
 */
const resolveSingleUseIdOnce = reactCache(
  (
    surveyId: string,
    isEncrypted: boolean,
    suId: string | undefined,
    suToken: string | undefined,
    surface: TSingleUseLinkSurface
  ): string | null => resolveSingleUseIdForSurvey({ surveyId, isEncrypted, suId, suToken, surface })
);

/**
 * `singleUseId` is the canonical id to record against a response, and is absent when the survey does not
 * use single-use links.
 */
export type TLinkSurveySingleUseAccess = { allowed: true; singleUseId?: string } | { allowed: false };

/**
 * Whether a request to a public link-survey surface carries the single-use link the survey requires.
 *
 * The decision every such surface makes, in one place: the link page, the contact page, the page metadata,
 * and the PIN and verify-email actions. The PIN action once took no link at all and handed a single-use
 * survey's definition to anyone with its id, while the page refused the same caller (ENG-4041). A surface
 * that answers "not allowed" must answer exactly as it does for a survey that does not exist.
 *
 * `suId` and `suToken` are the raw URL values, never a canonical `singleUseId`: in encrypted mode the
 * canonical id is the decrypted cuid, while the token signs the ciphertext.
 */
export const getLinkSurveySingleUseAccess = ({
  survey,
  suId,
  suToken,
  surface,
}: {
  survey: Pick<TSurvey, "id" | "singleUse">;
  suId?: TSingleUseSearchParam;
  suToken?: TSingleUseSearchParam;
  surface: TSingleUseLinkSurface;
}): TLinkSurveySingleUseAccess => {
  if (!survey.singleUse?.enabled) {
    return { allowed: true };
  }

  const singleUseId = resolveSingleUseIdOnce(
    survey.id,
    survey.singleUse.isEncrypted,
    singleSearchParamValue(suId),
    singleSearchParamValue(suToken),
    surface
  );
  return singleUseId ? { allowed: true, singleUseId } : { allowed: false };
};
