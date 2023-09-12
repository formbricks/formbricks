import jwt from "jsonwebtoken";
import { prisma } from "@formbricks/database";
import { env } from "@/env.mjs";

export function createToken(userId, userEmail, options = {}) {
  return jwt.sign({ id: userId }, env.NEXTAUTH_SECRET + userEmail, options);
}
export function createTokenForLinkSurvey(surveyId, userEmail) {
  return jwt.sign({ email: userEmail }, env.NEXTAUTH_SECRET + surveyId);
}

export function verifyTokenForLinkSurvey(token, surveyId): Promise<boolean> {
  return new Promise((resolve) => {
    jwt.verify(token, env.NEXTAUTH_SECRET + surveyId, function (err) {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export async function verifyToken(token, userEmail = "") {
  if (!userEmail) {
    const { id } = jwt.decode(token);

    const foundUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!foundUser) {
      return null;
    }

    userEmail = foundUser.email;
  }

  return jwt.verify(token, env.NEXTAUTH_SECRET + userEmail);
}

export const createInviteToken = (inviteId: string, email: string, options = {}) => {
  return jwt.sign({ inviteId, email }, env.NEXTAUTH_SECRET, options);
};

export const verifyInviteToken = async (token: string) => {
  try {
    const decoded = jwt.decode(token);
    return {
      inviteId: decoded.inviteId,
      email: decoded.email,
    };
  } catch (error) {
    console.error("Error verifying invite token:", error);
    throw new Error("Invalid or expired invite token");
  }
};
