import jwt from "jsonwebtoken";
import getConfig from "next/config";
import { prisma } from "database";

const { serverRuntimeConfig } = getConfig();

export function createToken(userId, userEmail, options = {}) {
  return jwt.sign({ id: userId }, serverRuntimeConfig.nextauthSecret + userEmail, options);
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

  return jwt.verify(token, serverRuntimeConfig.nextauthSecret + userEmail);
}
