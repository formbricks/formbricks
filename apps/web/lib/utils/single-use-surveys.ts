import { createId, isCuid } from "@paralleldrive/cuid2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { symmetricEncrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

const SINGLE_USE_SIGNATURE_PAYLOAD_PREFIX = "formbricks.single-use.v1";

export type TSurveySingleUseLinkParams = {
  suId: string;
  suToken?: string;
};

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

  const expectedSignature = generateSurveySingleUseSignature(surveyId, singleUseId);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const generateSurveySingleUseLinkParams = (
  surveyId: string,
  isEncrypted: boolean,
  singleUseId?: string
): TSurveySingleUseLinkParams => {
  if (isEncrypted) {
    return { suId: generateSurveySingleUseId(true) };
  }

  const suId = singleUseId?.trim() || generateSurveySingleUseId(false);

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
}): string | null => {
  const trimmedSuId = suId?.trim();

  if (!trimmedSuId) {
    return null;
  }

  if (isEncrypted) {
    try {
      const decryptedSingleUseId = decrypt(trimmedSuId);
      return isCuid(decryptedSingleUseId) ? decryptedSingleUseId : null;
    } catch {
      return null;
    }
  }

  return validateSurveySingleUseSignature(surveyId, trimmedSuId, suToken) ? trimmedSuId : null;
};
