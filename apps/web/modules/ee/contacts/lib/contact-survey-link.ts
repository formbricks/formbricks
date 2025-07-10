import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import jwt from "jsonwebtoken";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";

// Creates an encrypted personalized survey link for a contact
export const getContactSurveyLink = (
  contactId: string,
  surveyId: string,
  expirationDays?: number
): Result<string, ApiErrorResponseV2> => {
  if (!ENCRYPTION_KEY) {
    return err({
      type: "internal_server_error",
      message: "Encryption key not found - cannot create personalized survey link",
    });
  }

  // Encrypt the contact and survey IDs
  const encryptedContactId = symmetricEncrypt(contactId, ENCRYPTION_KEY);
  const encryptedSurveyId = symmetricEncrypt(surveyId, ENCRYPTION_KEY);

  // Create JWT payload with encrypted IDs
  const payload = {
    contactId: encryptedContactId,
    surveyId: encryptedSurveyId,
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
  return ok(`${getPublicDomain()}/c/${token}`);
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
    const decoded = jwt.verify(token, ENCRYPTION_KEY) as { contactId: string; surveyId: string };

    if (!decoded || !decoded.contactId || !decoded.surveyId) {
      throw err("Invalid token format");
    }

    // Decrypt the contact and survey IDs
    const contactId = symmetricDecrypt(decoded.contactId, ENCRYPTION_KEY);
    const surveyId = symmetricDecrypt(decoded.surveyId, ENCRYPTION_KEY);

    return ok({
      contactId,
      surveyId,
    });
  } catch (error) {
    logger.error("Error verifying contact survey token:", error);

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
