import { symmetricEncrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import cuid2 from "@paralleldrive/cuid2";

// generate encrypted single use id for the survey
export const generateSurveySingleUseId = (isEncrypted: boolean): string => {
  const cuid = cuid2.createId();
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
