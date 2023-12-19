import jwt, { JwtPayload } from "jsonwebtoken";

import { prisma } from "@formbricks/database";

import { env } from "./env.mjs";

export function createToken(userId: string, userEmail: string, options = {}): string {
  return jwt.sign({ id: userId }, env.NEXTAUTH_SECRET + userEmail, options);
}
export function createTokenForLinkSurvey(surveyId: string, userEmail: string): string {
  return jwt.sign({ email: userEmail }, env.NEXTAUTH_SECRET + surveyId);
}

export const createInviteToken = (inviteId: string, email: string, options = {}): string => {
  return jwt.sign({ inviteId, email }, env.NEXTAUTH_SECRET, options);
};

export function verifyTokenForLinkSurvey(token: string, surveyId: string): Promise<boolean> {
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

export async function verifyToken(token: string, userEmail: string = ""): Promise<JwtPayload> {
  if (!token) {
    throw new Error("No token found");
  }
  const decoded = jwt.decode(token);
  const payload: JwtPayload = decoded as JwtPayload;
  const { id } = payload;

  if (!userEmail) {
    const foundUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!foundUser) {
      throw new Error("User not found");
    }

    userEmail = foundUser.email;
  }

  return jwt.verify(token, env.NEXTAUTH_SECRET + userEmail) as JwtPayload;
}

export const verifyInviteToken = (token: string): { inviteId: string; email: string } => {
  try {
    const decoded = jwt.decode(token);
    const payload: JwtPayload = decoded as JwtPayload;

    const { inviteId, email } = payload;

    return {
      inviteId,
      email,
    };
  } catch (error) {
    console.error("Error verifying invite token:", error);
    throw new Error("Invalid or expired invite token");
  }
};
