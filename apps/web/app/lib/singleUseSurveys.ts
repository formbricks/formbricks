import cuid2 from "@paralleldrive/cuid2";
import { ENCRYPTION_KEY, FORMBRICKS_ENCRYPTION_KEY } from "@formbricks/lib/constants";
import { decryptAES128, symmetricDecrypt, symmetricEncrypt } from "@formbricks/lib/crypto";

// generate encrypted single use id for the survey
export const generateSurveySingleUseId = (isEncrypted: boolean): string => {
  const cuid = cuid2.createId();
  if (!isEncrypted) {
    return cuid;
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedCuid = symmetricEncrypt(cuid, ENCRYPTION_KEY);
  return encryptedCuid;
};

// validate the survey single use id
export const validateSurveySingleUseId = (surveySingleUseId: string): string | undefined => {
  try {
    let decryptedCuid: string | null = null;

    if (surveySingleUseId.length === 64) {
      if (!FORMBRICKS_ENCRYPTION_KEY) {
        throw new Error("FORMBRICKS_ENCRYPTION_KEY is not defined");
      }

      decryptedCuid = decryptAES128(FORMBRICKS_ENCRYPTION_KEY!, surveySingleUseId);
    } else {
      if (!ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY is not set");
      }
      decryptedCuid = symmetricDecrypt(surveySingleUseId, ENCRYPTION_KEY);
    }

    if (cuid2.isCuid(decryptedCuid)) {
      return decryptedCuid;
    } else {
      return undefined;
    }
  } catch (error) {
    return undefined;
  }
};
