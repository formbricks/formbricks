import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@formbricks/database";
import qrcode from "qrcode";
import { authenticator } from "otplib";
import crypto from "crypto";
import { symmetricEncrypt } from "@formbricks/lib/crypto";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Not authenticated", {
      status: 401,
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  });

  if (!user) {
    return new Response("User not found", {
      status: 404,
    });
  }

  if (user.twoFactorEnabled) {
    return new Response("Two factor already enabled", {
      status: 400,
    });
  }

  // This generates a secret 32 characters in length. Do not modify the number of
  // bytes without updating the sanity checks in the enable and login endpoints.
  const secret = authenticator.generateSecret(20);

  // generate backup codes with 10 character length
  const backupCodes = Array.from(Array(10), () => crypto.randomBytes(5).toString("hex"));

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      backupCodes: symmetricEncrypt(JSON.stringify(backupCodes), process.env.FORMBRICKS_ENCRYPTION_KEY),
      twoFactorEnabled: false,
      twoFactorSecret: symmetricEncrypt(secret, process.env.FORMBRICKS_ENCRYPTION_KEY),
    },
  });

  const name = user.email || user.name || user.id.toString();
  const keyUri = authenticator.keyuri(name, "Cal", secret);
  const dataUri = await qrcode.toDataURL(keyUri);

  return NextResponse.json({ secret, keyUri, dataUri, backupCodes });
}
