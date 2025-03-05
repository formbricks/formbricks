import jwt from "jsonwebtoken";
import { ENCRYPTION_KEY, WEBAPP_URL } from "@formbricks/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@formbricks/lib/crypto";

/**
 * Creates an encrypted personalized survey link for a contact
 *
 * @param contactId The ID of the contact
 * @param surveyId The ID of the survey
 * @param expirationDays Optional number of days until the link expires (no expiration if not specified)
 * @returns A personalized survey URL with an encrypted JWT token
 */
export const getContactSurveyLink = (
  contactId: string,
  surveyId: string,
  expirationDays?: number
): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key not found - cannot create personalized survey link");
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
  return `${WEBAPP_URL}/c/${token}`;
};

/**
 * Validates and decrypts a contact survey JWT token
 *
 * @param token The JWT token to verify
 * @returns The decoded contact and survey IDs
 */
export const verifyContactSurveyToken = (token: string): { contactId: string; surveyId: string } => {
  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key not found - cannot verify survey token");
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, ENCRYPTION_KEY) as { contactId: string; surveyId: string };

    if (!decoded || !decoded.contactId || !decoded.surveyId) {
      throw new Error("Invalid token format");
    }

    // Decrypt the contact and survey IDs
    const contactId = symmetricDecrypt(decoded.contactId, ENCRYPTION_KEY);
    const surveyId = symmetricDecrypt(decoded.surveyId, ENCRYPTION_KEY);

    return {
      contactId,
      surveyId,
    };
  } catch (error) {
    console.error("Error verifying contact survey token:", error);
    throw new Error("Invalid or expired survey token");
  }
};
