import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ENCRYPTION_KEY, NEXTAUTH_SECRET } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";

// Helper function to decrypt with fallback to plain text
const decryptWithFallback = (encryptedText: string, key: string): string => {
  try {
    return symmetricDecrypt(encryptedText, key);
  } catch {
    return encryptedText; // Return as-is if decryption fails (legacy format)
  }
};

export const createToken = (userId: string, options = {}): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedUserId = symmetricEncrypt(userId, ENCRYPTION_KEY);
  return jwt.sign({ id: encryptedUserId }, NEXTAUTH_SECRET, options);
};
export const createTokenForLinkSurvey = (surveyId: string, userEmail: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedEmail = symmetricEncrypt(userEmail, ENCRYPTION_KEY);
  return jwt.sign({ email: encryptedEmail, surveyId }, NEXTAUTH_SECRET);
};

export const verifyEmailChangeToken = async (token: string): Promise<{ id: string; email: string }> => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as {
    id: string;
    email: string;
  };

  if (!payload?.id || !payload?.email) {
    throw new Error("Token is invalid or missing required fields");
  }

  // Decrypt both fields with fallback
  const decryptedId = decryptWithFallback(payload.id, ENCRYPTION_KEY);
  const decryptedEmail = decryptWithFallback(payload.email, ENCRYPTION_KEY);

  return {
    id: decryptedId,
    email: decryptedEmail,
  };
};

export const createEmailChangeToken = (userId: string, email: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedUserId = symmetricEncrypt(userId, ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, ENCRYPTION_KEY);

  const payload = {
    id: encryptedUserId,
    email: encryptedEmail,
  };

  return jwt.sign(payload, NEXTAUTH_SECRET, {
    expiresIn: "1d",
  });
};

export const createEmailToken = (email: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedEmail = symmetricEncrypt(email, ENCRYPTION_KEY);
  return jwt.sign({ email: encryptedEmail }, NEXTAUTH_SECRET);
};

export const getEmailFromEmailToken = (token: string): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
    email: string;
  };
  return decryptWithFallback(payload.email, ENCRYPTION_KEY);
};

export const createInviteToken = (inviteId: string, email: string, options = {}): string => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedInviteId = symmetricEncrypt(inviteId, ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, ENCRYPTION_KEY);
  return jwt.sign({ inviteId: encryptedInviteId, email: encryptedEmail }, NEXTAUTH_SECRET, options);
};

export const verifyTokenForLinkSurvey = (token: string, surveyId: string): string | null => {
  if (!NEXTAUTH_SECRET) {
    return null;
  }

  try {
    let payload: JwtPayload & { email: string; surveyId?: string };

    // Try primary method first (consistent secret)
    try {
      payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
        email: string;
        surveyId: string;
      };
    } catch (primaryError) {
      logger.error(primaryError, "Token verification failed with primary method");

      // Fallback to legacy method (surveyId-based secret)
      try {
        payload = jwt.verify(token, NEXTAUTH_SECRET + surveyId, { algorithms: ["HS256"] }) as JwtPayload & {
          email: string;
        };
      } catch (legacyError) {
        logger.error(legacyError, "Token verification failed with legacy method");
        throw new Error("Invalid token");
      }
    }

    // Verify the surveyId matches if present in payload (new format)
    if (payload.surveyId && payload.surveyId !== surveyId) {
      return null;
    }

    const { email } = payload;
    if (!email) {
      return null;
    }

    // Decrypt email with fallback to plain text
    if (!ENCRYPTION_KEY) {
      return email; // Return as-is if encryption key not set
    }

    return decryptWithFallback(email, ENCRYPTION_KEY);
  } catch (error) {
    logger.error(error, "Survey link token verification failed");
    return null;
  }
};

// Helper function to get user email for legacy verification
const getUserEmailForLegacyVerification = async (
  token: string,
  userId?: string
): Promise<{ userId: string; userEmail: string }> => {
  if (!userId) {
    const decoded = jwt.decode(token);

    // Validate decoded token structure before using it
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !decoded.id ||
      typeof decoded.id !== "string" ||
      decoded.id.trim() === ""
    ) {
      logger.error("Invalid token: missing or invalid user ID");
      throw new Error("Invalid token");
    }

    userId = decoded.id;
  }

  const decryptedId = decryptWithFallback(userId, ENCRYPTION_KEY);

  // Validate decrypted ID before database query
  if (!decryptedId || typeof decryptedId !== "string" || decryptedId.trim() === "") {
    logger.error("Invalid token: missing or invalid user ID");
    throw new Error("Invalid token");
  }

  const foundUser = await prisma.user.findUnique({
    where: { id: decryptedId },
  });

  if (!foundUser) {
    const errorMessage = "User not found";
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return { userId: decryptedId, userEmail: foundUser.email };
};

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  let payload: JwtPayload & { id: string };
  let userData: { userId: string; userEmail: string } | null = null;

  // Try new method first, with smart fallback to legacy
  try {
    payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
      id: string;
    };
  } catch (newMethodError) {
    logger.error(newMethodError, "Token verification failed with new method");

    // Get user email for legacy verification
    userData = await getUserEmailForLegacyVerification(token);

    // Try legacy verification with email-based secret
    try {
      payload = jwt.verify(token, NEXTAUTH_SECRET + userData.userEmail, {
        algorithms: ["HS256"],
      }) as JwtPayload & {
        id: string;
      };
    } catch (legacyMethodError) {
      logger.error(legacyMethodError, "Token verification failed with legacy method");
      throw new Error("Invalid token");
    }
  }

  if (!payload?.id) {
    throw new Error("Invalid token");
  }

  // Get user email if we don't have it yet
  userData ??= await getUserEmailForLegacyVerification(token, payload.id);

  return { id: userData.userId, email: userData.userEmail };
};

export const verifyInviteToken = (token: string): { inviteId: string; email: string } => {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  try {
    const payload = jwt.verify(token, NEXTAUTH_SECRET, { algorithms: ["HS256"] }) as JwtPayload & {
      inviteId: string;
      email: string;
    };

    const { inviteId: encryptedInviteId, email: encryptedEmail } = payload;

    if (!encryptedInviteId || !encryptedEmail) {
      throw new Error("Invalid token");
    }

    // Decrypt both fields with fallback to original values
    const decryptedInviteId = decryptWithFallback(encryptedInviteId, ENCRYPTION_KEY);
    const decryptedEmail = decryptWithFallback(encryptedEmail, ENCRYPTION_KEY);

    return {
      inviteId: decryptedInviteId,
      email: decryptedEmail,
    };
  } catch (error) {
    logger.error(error, "Error verifying invite token");
    throw new Error("Invalid or expired invite token");
  }
};
