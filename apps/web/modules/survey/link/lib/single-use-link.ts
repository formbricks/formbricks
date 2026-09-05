import "server-only";
import { createHash } from "node:crypto";
import { logger } from "@formbricks/logger";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
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
  suId?: string | null;
  suToken?: string | null;
  surface: TSingleUseLinkSurface;
}): string | null => {
  const mode = isEncrypted ? "encrypted" : "plaintext";

  let result: TSurveySingleUseLinkValidation;
  try {
    result = validateSurveySingleUseLinkParams({
      surveyId,
      suId,
      suToken,
      isEncrypted,
      decrypt: (encryptedSingleUseId) => symmetricDecrypt(encryptedSingleUseId, ENCRYPTION_KEY),
    });
  } catch (error) {
    // Reachable only when ENCRYPTION_KEY is unset or empty, which the signing helper throws on. The
    // response endpoints answer 500 for that before they reach here; the page renderer has no such
    // check, so it has to fail closed rather than render the survey.
    logger.error({ error, surveyId, surface }, "Single-use link validation failed unexpectedly");
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
    logger.warn(
      {
        surveyId,
        surface,
        mode,
        reason: result.reason,
        ...(suToken ? { suTokenFingerprint: fingerprintSuToken(suToken) } : {}),
      },
      "Rejected single-use survey link"
    );
    recordSingleUseLinkValidation({ mode, outcome: "rejected", reason: result.reason, surface });
    return null;
  }

  recordSingleUseLinkValidation({ mode, outcome: "accepted", reason: "none", surface });
  return result.singleUseId;
};
