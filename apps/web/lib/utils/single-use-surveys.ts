import { createId, isCuid } from "@paralleldrive/cuid2";
import { createHmac } from "node:crypto";
import { constantTimeEqual, symmetricEncrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

const SINGLE_USE_SIGNATURE_PAYLOAD_PREFIX = "formbricks.single-use.v1";

export type TSurveySingleUseLinkParams = {
  suId: string;
  /**
   * HMAC over the survey id and the `suId` **exactly as it appears in the URL** — a ciphertext in
   * encrypted mode, a CUID in plaintext mode. Minted in both modes since ENG-2758, and required so
   * that dropping the survey binding again is a compile error rather than a silent vulnerability.
   *
   * Consumers that build a link URL still guard with `if (suToken)`. That is not dead code: these
   * params travel back from a server action, so during a rolling deploy a new client bundle can hit
   * an old pod that returns `{ suId }` alone. Without the guard the URL would carry the literal
   * string `suToken=undefined`, which validates as `signature_mismatch` and would send an operator
   * hunting a key-rotation problem that does not exist.
   */
  suToken: string;
};

export type TSurveySingleUseLinkRejectionReason =
  | "missing_su_id"
  | "missing_signature"
  | "signature_mismatch"
  | "decryption_failed"
  | "not_a_cuid";

/**
 * A discriminated union rather than `string | null` because the reason is what makes a rejection
 * diagnosable. "Rejected" tells an operator nothing; `signature_mismatch` 4,000 times with distinct
 * token fingerprints says a survey is being enumerated, while `missing_signature` 200 times with no
 * fingerprint says somebody mailed links minted before this release.
 */
export type TSurveySingleUseLinkValidation =
  | { ok: true; singleUseId: string }
  | { ok: false; reason: TSurveySingleUseLinkRejectionReason };

const getSingleUseSigningKey = (): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  return env.ENCRYPTION_KEY;
};

// generate encrypted single use id for the survey
export const generateSurveySingleUseId = (isEncrypted: boolean): string => {
  const cuid = createId();
  if (!isEncrypted) {
    return cuid;
  }

  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedCuid = symmetricEncrypt(cuid, env.ENCRYPTION_KEY);
  return encryptedCuid;
};

export const generateSurveySingleUseIds = (count: number, isEncrypted: boolean): string[] => {
  const singleUseIds: string[] = [];

  for (let i = 0; i < count; i++) {
    singleUseIds.push(generateSurveySingleUseId(isEncrypted));
  }

  return singleUseIds;
};

export const generateSurveySingleUseSignature = (surveyId: string, singleUseId: string): string => {
  // The fields are joined, not length-prefixed, so this relies on `surveyId` never containing a
  // colon: it is a cuid2 at the mint action (ZGenerateSingleUseIdAction) and a database id at every
  // validation site. A *custom* `singleUseId` may contain one, so without that assumption
  // ("survey-1", "b:CUSTOM") and ("survey-1:b", "CUSTOM") would sign identically. Fixing it means
  // bumping the payload prefix, which would invalidate every plaintext suToken in the wild — see the
  // payload-v2 follow-up rather than changing the format here.
  const payload = `${SINGLE_USE_SIGNATURE_PAYLOAD_PREFIX}:${surveyId}:${singleUseId}`;

  return createHmac("sha256", getSingleUseSigningKey()).update(payload).digest("hex");
};

export const validateSurveySingleUseSignature = (
  surveyId: string,
  singleUseId: string,
  signature?: string | null
): boolean => {
  if (!signature) {
    return false;
  }

  return constantTimeEqual(generateSurveySingleUseSignature(surveyId, singleUseId), signature);
};

export const generateSurveySingleUseLinkParams = (
  surveyId: string,
  isEncrypted: boolean,
  singleUseId?: string
): TSurveySingleUseLinkParams => {
  // A custom id stays plaintext-only — it is not recoverable from a ciphertext, and
  // ZGenerateSingleUseIdAction already refuses the combination.
  const suId = isEncrypted
    ? generateSurveySingleUseId(true)
    : singleUseId?.trim() || generateSurveySingleUseId(false);

  // Signed in both modes since ENG-2758. Before that the encrypted branch returned the ciphertext
  // alone and discarded `surveyId`, so an encrypted link was bound to nothing and any survey on the
  // deployment accepted it.
  return {
    suId,
    suToken: generateSurveySingleUseSignature(surveyId, suId),
  };
};

export const generateSurveySingleUseLinkParamsList = (
  count: number,
  surveyId: string,
  isEncrypted: boolean
): TSurveySingleUseLinkParams[] => {
  const singleUseLinkParams: TSurveySingleUseLinkParams[] = [];

  for (let i = 0; i < count; i++) {
    singleUseLinkParams.push(generateSurveySingleUseLinkParams(surveyId, isEncrypted));
  }

  return singleUseLinkParams;
};

export const validateSurveySingleUseLinkParams = ({
  surveyId,
  suId,
  suToken,
  isEncrypted,
  decrypt,
}: {
  surveyId: string;
  suId?: string | null;
  suToken?: string | null;
  isEncrypted: boolean;
  decrypt: (encryptedSingleUseId: string) => string;
}): TSurveySingleUseLinkValidation => {
  const trimmedSuId = suId?.trim();

  if (!trimmedSuId) {
    return { ok: false, reason: "missing_su_id" };
  }

  // Authenticate, then decrypt — in that order, and never the other way round. The signature covers
  // the `suId` as it appears in the URL, so it can be verified without touching the cipher, and must
  // be, for two reasons:
  //
  //  1. `symmetricDecrypt` picks its algorithm by counting colons (lib/crypto.ts:88) and routes a
  //     two-part payload to unauthenticated AES-256-CBC, bypassing the GCM path's own refusal to
  //     fall back. Verifying first means no attacker-chosen bytes ever reach that branch from a
  //     public endpoint.
  //  2. Decrypt-then-`isCuid` accepts *any* ciphertext under ENCRYPTION_KEY whose plaintext happens
  //     to be a cuid2 — including the `contactId` that getContactSurveyLink encrypts into the
  //     base64url (readable) payload of a /c/{jwt} personalized link. Only the MAC distinguishes
  //     "a single-use id minted for THIS survey" from "a cuid this deployment once encrypted".
  if (!validateSurveySingleUseSignature(surveyId, trimmedSuId, suToken)) {
    return { ok: false, reason: suToken ? "signature_mismatch" : "missing_signature" };
  }

  if (!isEncrypted) {
    return { ok: true, singleUseId: trimmedSuId };
  }

  let decryptedSingleUseId: string;
  try {
    decryptedSingleUseId = decrypt(trimmedSuId);
  } catch {
    return { ok: false, reason: "decryption_failed" };
  }

  if (!isCuid(decryptedSingleUseId)) {
    return { ok: false, reason: "not_a_cuid" };
  }

  return { ok: true, singleUseId: decryptedSingleUseId };
};
