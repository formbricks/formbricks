import cuid2 from "@paralleldrive/cuid2";
import { ENCRYPTION_KEY } from "@formbricks/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@formbricks/lib/crypto";

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
  let decryptedCuid: string | null = null;

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  try {
    decryptedCuid = symmetricDecrypt(surveySingleUseId, ENCRYPTION_KEY);
  } catch (error) {
    return undefined;
  }

  if (cuid2.isCuid(decryptedCuid)) {
    return decryptedCuid;
  } else {
    return undefined;
  }
};
