import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "@formbricks/database";
import { symmetricDecrypt, symmetricEncrypt } from "./crypto";
import { env } from "./env";

export const createToken = (userId: string, userEmail: string, options = {}): string => {
  const encryptedUserId = symmetricEncrypt(userId, env.ENCRYPTION_KEY);
  return jwt.sign({ id: encryptedUserId }, env.NEXTAUTH_SECRET + userEmail, options);
};
export const createTokenForLinkSurvey = (surveyId: string, userEmail: string): string => {
  const encryptedEmail = symmetricEncrypt(userEmail, env.ENCRYPTION_KEY);
  return jwt.sign({ email: encryptedEmail }, env.NEXTAUTH_SECRET + surveyId);
};

export const createEmailToken = (email: string): string => {
  const encryptedEmail = symmetricEncrypt(email, env.ENCRYPTION_KEY);
  return jwt.sign({ email: encryptedEmail }, env.NEXTAUTH_SECRET);
};

export const getEmailFromEmailToken = (token: string): string => {
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
  const encryptedInviteId = symmetricEncrypt(inviteId, env.ENCRYPTION_KEY);
  const encryptedEmail = symmetricEncrypt(email, env.ENCRYPTION_KEY);
  return jwt.sign({ inviteId: encryptedInviteId, email: encryptedEmail }, env.NEXTAUTH_SECRET, options);
};

export const verifyTokenForLinkSurvey = (token: string, surveyId: string) => {
  try {
    const { email } = jwt.verify(token, env.NEXTAUTH_SECRET + surveyId) as JwtPayload;
    try {
      // Try to decrypt first (for newer tokens)
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
  // First decode to get the ID
  const decoded = jwt.decode(token);
  const payload: JwtPayload = decoded as JwtPayload;

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
    console.error(`Error verifying invite token: ${error}`);
    throw new Error("Invalid or expired invite token");
  }
};
