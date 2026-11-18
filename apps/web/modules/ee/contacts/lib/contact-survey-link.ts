import jwt from "jsonwebtoken";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { getPublicDomain } from "@/lib/getPublicUrl";
import {
  type TSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParams,
} from "@/lib/utils/single-use-surveys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getSurvey } from "@/modules/survey/lib/survey";

/**
 * Names the flow this token was minted for. The signing key (`ENCRYPTION_KEY`) is also the key other
 * features sign with, so a signature alone does not say a token is a contact survey link.
 * Links issued before the claim existed carry none and are still accepted (see
 * `verifyContactSurveyToken`): never require it, or every link already emailed stops working.
 */
export const CONTACT_SURVEY_LINK_PURPOSE = "contact_survey_link";

// Creates an encrypted personalized survey link for a contact
export const getContactSurveyLink = async (
  contactId: string,
  surveyId: string,
  expirationDays?: number
): Promise<Result<string, ApiErrorResponseV2>> => {
  if (!ENCRYPTION_KEY) {
    return err({
      type: "internal_server_error",
      message: "Encryption key not found - cannot create personalized survey link",
    });
  }

  const survey = await getSurvey(surveyId);
  if (!survey) {
    return err({
      type: "not_found",
      message: "Survey not found",
      details: [{ field: "surveyId", issue: "not_found" }],
    });
  }

  const { enabled: isSingleUseEnabled, isEncrypted: isSingleUseEncrypted } = survey.singleUse ?? {};

  // Encrypt the contact and survey IDs
  const encryptedContactId = symmetricEncrypt(contactId, ENCRYPTION_KEY);
  const encryptedSurveyId = symmetricEncrypt(surveyId, ENCRYPTION_KEY);

  let singleUseLinkParams: TSurveySingleUseLinkParams | undefined;

  if (isSingleUseEnabled) {
    singleUseLinkParams = generateSurveySingleUseLinkParams(surveyId, isSingleUseEncrypted ?? false);
  }

  // Create JWT payload with encrypted IDs
  const payload = {
    contactId: encryptedContactId,
    surveyId: encryptedSurveyId,
    purpose: CONTACT_SURVEY_LINK_PURPOSE,
  };

  // Set token options
  const tokenOptions: jwt.SignOptions = {
    algorithm: "HS256",
  };

  // Add expiration if specified
  if (expirationDays !== undefined && expirationDays > 0) {
    tokenOptions.expiresIn = `${expirationDays}d`;
  }

  // Sign the token with ENCRYPTION_KEY using SHA256
  const token = jwt.sign(payload, ENCRYPTION_KEY, tokenOptions);

  // Return the personalized URL
  const surveyUrl = `${getPublicDomain()}/c/${token}`;
  if (!singleUseLinkParams) {
    return ok(surveyUrl);
  }

  const searchParams = new URLSearchParams({ suId: singleUseLinkParams.suId });
  if (singleUseLinkParams.suToken) {
    searchParams.set("suToken", singleUseLinkParams.suToken);
  }

  return ok(`${surveyUrl}?${searchParams.toString()}`);
};

// `/c/<token>` is public, so a malformed, forged or expired token is routine input, not a fault: it is
// logged as a warning. Anything else (a decrypt failure on a signed token) is ours and stays an error.
class RejectedContactTokenError extends Error {}

const logTokenVerificationFailure = (error: unknown): void => {
  const failure = error instanceof Error ? error : new Error(String(error));
  // JsonWebTokenError is the base of expired, not-yet-valid, bad-signature and malformed.
  if (error instanceof jwt.JsonWebTokenError || error instanceof RejectedContactTokenError) {
    logger.warn({ err: failure }, "Contact survey token rejected");
    return;
  }
  logger.error(failure, "Error verifying contact survey token");
};

// Validates and decrypts a contact survey JWT token
export const verifyContactSurveyToken = (
  token: string
): Result<{ contactId: string; surveyId: string }, ApiErrorResponseV2> => {
  if (!ENCRYPTION_KEY) {
    return err({
      type: "internal_server_error",
      message: "Encryption key not found - cannot verify survey token",
    });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, ENCRYPTION_KEY, { algorithms: ["HS256"] }) as {
      contactId: string;
      surveyId: string;
      purpose?: string;
    };

    if (!decoded?.contactId || !decoded.surveyId) {
      throw new RejectedContactTokenError("Invalid token format");
    }

    // Absent on links issued before the claim existed; present-but-different means another flow's token.
    if (decoded.purpose !== undefined && decoded.purpose !== CONTACT_SURVEY_LINK_PURPOSE) {
      throw new RejectedContactTokenError("Token was not issued as a contact survey link");
    }

    // Decrypt the contact and survey IDs
    const contactId = symmetricDecrypt(decoded.contactId, ENCRYPTION_KEY);
    const surveyId = symmetricDecrypt(decoded.surveyId, ENCRYPTION_KEY);

    return ok({
      contactId,
      surveyId,
    });
  } catch (error) {
    logTokenVerificationFailure(error);

    // Check if the error is specifically a JWT expiration error
    if (error instanceof jwt.TokenExpiredError) {
      return err({
        type: "bad_request",
        message: "Survey link has expired",
        details: [{ field: "token", issue: "token_expired" }],
      });
    }

    // Handle other JWT errors or general validation errors
    return err({
      type: "bad_request",
      message: "Invalid survey token",
      details: [{ field: "token", issue: "invalid_token" }],
    });
  }
};
