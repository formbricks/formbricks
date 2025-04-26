import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";

export const createToken = (userId: string, userEmail: string, options = {}): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedUserId = symmetricEncrypt(userId, env.ENCRYPTION_KEY);
  return jwt.sign({ id: encryptedUserId }, env.NEXTAUTH_SECRET + userEmail, options);
};
export const createTokenForLinkSurvey = (surveyId: string, userEmail: string): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedEmail = symmetricEncrypt(userEmail, env.ENCRYPTION_KEY);
  return jwt.sign({ email: encryptedEmail }, env.NEXTAUTH_SECRET + surveyId);
};

export const verifyEmailChangeToken = async (token: string): Promise<{ id: string; email: string }> => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const decoded = jwt.decode(token);
  const payload = decoded as { id: string; email: string };

  if (!payload || !payload.id || !payload.email) {
    throw new Error("Token is invalid or missing required fields");
  }

  let decryptedId: string;
  let decryptedEmail: string;

  try {
    decryptedId = symmetricDecrypt(payload.id, env.ENCRYPTION_KEY);
  } catch {
    decryptedId = payload.id;
  }

  try {
    decryptedEmail = symmetricDecrypt(payload.email, env.ENCRYPTION_KEY);
  } catch {
    decryptedEmail = payload.email;
  }

  return {
    id: decryptedId,
    email: decryptedEmail,
  };
};

export const createEmailChangeToken = (userId: string, email: string): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const encryptedUserId = symmetricEncrypt(userId, env.ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, env.ENCRYPTION_KEY);

  const payload = {
    id: encryptedUserId,
    email: encryptedEmail,
  };

  return jwt.sign(payload, env.NEXTAUTH_SECRET as string, {
    expiresIn: "1d",
  });
};
export const createEmailToken = (email: string): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  if (!env.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  const encryptedEmail = symmetricEncrypt(email, env.ENCRYPTION_KEY);
  return jwt.sign({ email: encryptedEmail }, env.NEXTAUTH_SECRET);
};

export const getEmailFromEmailToken = (token: string): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  if (!env.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  const payload = jwt.verify(token, env.NEXTAUTH_SECRET) as JwtPayload;
  try {
    // Try to decrypt first (for newer tokens)
    const decryptedEmail = symmetricDecrypt(payload.email, env.ENCRYPTION_KEY);
    return decryptedEmail;
  } catch {
    // If decryption fails, return the original email (for older tokens)
    return payload.email;
  }
};

export const createInviteToken = (inviteId: string, email: string, options = {}): string => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  if (!env.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }
  const encryptedInviteId = symmetricEncrypt(inviteId, env.ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, env.ENCRYPTION_KEY);
  return jwt.sign({ inviteId: encryptedInviteId, email: encryptedEmail }, env.NEXTAUTH_SECRET, options);
};

export const verifyTokenForLinkSurvey = (token: string, surveyId: string): string | null => {
  try {
    const { email } = jwt.verify(token, env.NEXTAUTH_SECRET + surveyId) as JwtPayload;
    try {
      // Try to decrypt first (for newer tokens)
      if (!env.ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY is not set");
      }
      const decryptedEmail = symmetricDecrypt(email, env.ENCRYPTION_KEY);
      return decryptedEmail;
    } catch {
      // If decryption fails, return the original email (for older tokens)
      return email;
    }
  } catch (err) {
    return null;
  }
};

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  // First decode to get the ID
  const decoded = jwt.decode(token);
  const payload: JwtPayload = decoded as JwtPayload;

  if (!payload) {
    throw new Error("Token is invalid");
  }

  const { id } = payload;
  if (!id) {
    throw new Error("Token missing required field: id");
  }

  // Try to decrypt the ID (for newer tokens), if it fails use the ID as-is (for older tokens)
  let decryptedId: string;
  try {
    decryptedId = symmetricDecrypt(id, env.ENCRYPTION_KEY);
  } catch {
    decryptedId = id;
  }

  // If no email provided, look up the user
  const foundUser = await prisma.user.findUnique({
    where: { id: decryptedId },
  });

  if (!foundUser) {
    throw new Error("User not found");
  }

  const userEmail = foundUser.email;

  return { id: decryptedId, email: userEmail };
};

export const verifyInviteToken = (token: string): { inviteId: string; email: string } => {
  try {
    if (!env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY is not set");
    }

    const decoded = jwt.decode(token);
    const payload: JwtPayload = decoded as JwtPayload;

    const { inviteId, email } = payload;

    let decryptedInviteId: string;
    let decryptedEmail: string;

    try {
      // Try to decrypt first (for newer tokens)
      decryptedInviteId = symmetricDecrypt(inviteId, env.ENCRYPTION_KEY);
      decryptedEmail = symmetricDecrypt(email, env.ENCRYPTION_KEY);
    } catch {
      // If decryption fails, use original values (for older tokens)
      decryptedInviteId = inviteId;
      decryptedEmail = email;
    }

    return {
      inviteId: decryptedInviteId,
      email: decryptedEmail,
    };
  } catch (error) {
    logger.error(error, "Error verifying invite token");
    throw new Error("Invalid or expired invite token");
  }
};
