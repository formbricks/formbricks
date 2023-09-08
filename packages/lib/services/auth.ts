import crypto from "crypto";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import { prisma } from "@formbricks/database";
import { symmetricEncrypt } from "../crypto";
import { verifyPassword } from "../auth";

export const setupTwoFactorAuth = async (
  userId: string,
  password: string
): Promise<{
  secret: string;
  keyUri: string;
  dataUri: string;
  backupCodes: string[];
}> => {
  // This generates a secret 32 characters in length. Do not modify the number of
  // bytes without updating the sanity checks in the enable and login endpoints.
  const secret = authenticator.generateSecret(20);

  // generate backup codes with 10 character length
  const backupCodes = Array.from(Array(10), () => crypto.randomBytes(5).toString("hex"));

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.password) {
    throw new Error("User does not have a password set");
  }

  const isCorrectPassword = await verifyPassword(password, user.password);

  if (!isCorrectPassword) {
    throw new Error("Incorrect password");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      backupCodes: symmetricEncrypt(JSON.stringify(backupCodes), process.env.FORMBRICKS_ENCRYPTION_KEY!),
      twoFactorEnabled: false,
      twoFactorSecret: symmetricEncrypt(secret, process.env.FORMBRICKS_ENCRYPTION_KEY!),
    },
  });

  const name = user.email || user.name || user.id.toString();
  const keyUri = authenticator.keyuri(name, "Formbricks", secret);
  const dataUri = await qrcode.toDataURL(keyUri);

  return { secret, keyUri, dataUri, backupCodes };
};
