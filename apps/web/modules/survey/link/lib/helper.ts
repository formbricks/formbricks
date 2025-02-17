import "server-only";
import { verifyTokenForLinkSurvey } from "@formbricks/lib/jwt";

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
