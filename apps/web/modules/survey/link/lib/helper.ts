import "server-only";
import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { verifyTokenForLinkSurvey } from "@/lib/jwt";

interface emailVerificationDetails {
  status: "not-verified" | "verified" | "fishy";
  email?: string;
}

export const getEmailVerificationDetails = async (
  surveyId: string,
  token: string
): Promise<emailVerificationDetails> => {
  if (!token) {
    return { status: "not-verified" };
  } else {
    try {
      const verifiedEmail = verifyTokenForLinkSurvey(token, surveyId);
      if (verifiedEmail) {
        return { status: "verified", email: verifiedEmail };
      } else {
        return { status: "fishy" };
      }
    } catch (error) {
      return { status: "not-verified" };
    }
  }
};

export const checkAndValidateSingleUseId = (suid?: string, isEncrypted = false): string | null => {
  if (!suid?.trim()) return null;

  if (isEncrypted) {
    const validatedSingleUseId = validateSurveySingleUseId(suid);
    if (!validatedSingleUseId) return null;
    return validatedSingleUseId;
  }

  return suid;
};
