import jwt from "jsonwebtoken";
import { prisma } from "@formbricks/database";

export function createToken(userId: string, userEmail: string, options: jwt.SignOptions = {}) {
  return jwt.sign({ id: userId }, process.env.NEXTAUTH_SECRET + userEmail, options);
}

export async function verifyToken(token: string, userEmail = "") {
  if (!userEmail) {
    const { id } = jwt.decode(token) as { id: string };

    const foundUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!foundUser) {
      return null;
    }

    userEmail = foundUser.email;
  }

  return jwt.verify(token, process.env.NEXTAUTH_SECRET + userEmail);
}

export const createInviteToken = (inviteId: string, email: string, options: jwt.SignOptions = {}) => {
  return jwt.sign({ inviteId, email }, process.env.NEXTAUTH_SECRET ?? "", options);
};

export const verifyInviteToken = async (token: string) => {
  try {
    const { inviteId, email } = jwt.decode(token) as { inviteId: string; email: string };

    return {
      inviteId,
      email,
    };
  } catch (error) {
    console.error("Error verifying invite token:", error);
    throw new Error("Invalid or expired invite token");
  }
};
