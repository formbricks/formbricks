import { FORMBRICKS_ENCRYPTION_KEY } from "@formbricks/lib/constants";
import { decryptAES128, encryptAES128 } from "@formbricks/lib/crypto";
import cuid2 from "@paralleldrive/cuid2";

// generate encrypted single use id for the survey
export const generateSurveySingleUseId = (isEncrypted: boolean): string => {
  const cuid = cuid2.createId();
  if (!isEncrypted) {
    return cuid;
  }
  if (!FORMBRICKS_ENCRYPTION_KEY) {
    throw new Error("FORMBRICKS_ENCRYPTION_KEY is not defined");
  }
  const encryptedCuid = encryptAES128(FORMBRICKS_ENCRYPTION_KEY, cuid);
  return encryptedCuid;
};

// validate the survey single use id
export const validateSurveySingleUseId = (surveySingleUseId: string): string | undefined => {
  if (!FORMBRICKS_ENCRYPTION_KEY) {
    throw new Error("FORMBRICKS_ENCRYPTION_KEY is not defined");
  }
  try {
    const decryptedCuid = decryptAES128(FORMBRICKS_ENCRYPTION_KEY!, surveySingleUseId);
    if (cuid2.isCuid(decryptedCuid)) {
      return decryptedCuid;
    } else {
      return undefined;
    }
  } catch (error) {
    return undefined;
  }
};
