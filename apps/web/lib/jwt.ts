import jwt from "jsonwebtoken";
import { prisma } from "@formbricks/database";

export function createToken(userId, userEmail, options = {}) {
  return jwt.sign({ id: userId }, process.env.NEXTAUTH_SECRET + userEmail, options);
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

  return jwt.verify(token, process.env.NEXTAUTH_SECRET + userEmail);
}
