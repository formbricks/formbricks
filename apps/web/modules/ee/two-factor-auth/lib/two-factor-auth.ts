import crypto from "crypto";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { getCredentialPasswordHash, verifyUserPassword } from "@/lib/user/password";
import { auth } from "@/modules/auth/lib/auth";
import { buildReencodedTwoFactorData } from "@/modules/auth/lib/cutover/reencode-two-factor";
import { totpAuthenticatorCheck } from "@/modules/auth/lib/totp";

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
    throw new ResourceNotFoundError("user", userId);
  }

  if (user.identityProvider !== "email") {
    throw new InvalidInputError("Third party login is already enabled");
  }

  // Password verification — the credential-account lookup and fail-closed "no password" handling —
  // is owned by verifyUserPassword; 2FA setup just needs the yes/no answer.
  const isCorrectPassword = await verifyUserPassword(userId, password);
  if (!isCorrectPassword) {
    throw new InvalidInputError("Incorrect password");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key not found");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      backupCodes: symmetricEncrypt(JSON.stringify(backupCodes), ENCRYPTION_KEY),
      twoFactorEnabled: false,
      twoFactorSecret: symmetricEncrypt(secret, ENCRYPTION_KEY),
    },
  });

  const name = user.email || user.name || user.id.toString();
  const keyUri = authenticator.keyuri(name, "Formbricks", secret);
  const dataUri = await qrcode.toDataURL(keyUri);

  return { secret, keyUri, dataUri, backupCodes };
};

export const enableTwoFactorAuth = async (id: string, code: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new ResourceNotFoundError("user", id);
  }

  if (user.identityProvider !== "email") {
    throw new InvalidInputError("Third party login is already enabled");
  }

  // Requires a credential account (password lives there post-ENG-1054, not on User.password).
  const passwordHash = await getCredentialPasswordHash(id);
  if (!passwordHash) {
    throw new InvalidInputError("User does not have a password set");
  }

  if (user.twoFactorEnabled) {
    throw new InvalidInputError("Two factor authentication is already enabled");
  }

  if (!user.twoFactorSecret) {
    throw new InvalidInputError("Two factor setup has not been completed");
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key not found");
  }

  const secret = symmetricDecrypt(user.twoFactorSecret, ENCRYPTION_KEY);
  if (secret.length !== 32) {
    throw new InvalidInputError("Invalid secret");
  }

  const isValidCode = totpAuthenticatorCheck(code, secret);
  if (!isValidCode) {
    throw new InvalidInputError("Invalid code");
  }

  // Better Auth's login-time TOTP/backup verification reads the `TwoFactor` table, not the legacy
  // `User.twoFactorSecret` column this flow writes — so we re-encode the same (already TOTP-verified)
  // secret + backup codes into that table, or login fails with "TOTP not enabled" (ENG-1824). `verified`
  // defaults to true, which is correct: we only reach here after checking a live TOTP code. Both writes
  // run in one transaction so the enabled flag and the BA row can't diverge.
  const { secretConfig } = await auth.$context;
  const twoFactorRow = await buildReencodedTwoFactorData(
    user.twoFactorSecret,
    user.backupCodes,
    secretConfig
  );
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { twoFactorEnabled: true } }),
    prisma.twoFactor.upsert({
      where: { userId: id },
      update: { ...twoFactorRow, verified: true },
      create: { userId: id, ...twoFactorRow, verified: true },
    }),
  ]);

  return {
    message: "Two factor authentication enabled",
  };
};

type TDisableTwoFactorAuthParams = {
  code?: string;
  password: string;
  backupCode?: string;
};

export const disableTwoFactorAuth = async (id: string, params: TDisableTwoFactorAuthParams) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new ResourceNotFoundError("user", id);
  }

  if (!user.twoFactorEnabled) {
    throw new InvalidInputError("Two factor authentication is not enabled");
  }

  if (user.identityProvider !== "email") {
    throw new InvalidInputError("Third party login is already enabled");
  }

  const { code, password, backupCode } = params;
  // Delegate password verification (credential lookup + fail-closed) to verifyUserPassword.
  const isCorrectPassword = await verifyUserPassword(id, password);
  if (!isCorrectPassword) {
    throw new InvalidInputError("Incorrect password");
  }

  // if user has 2fa and using backup code
  if (user.twoFactorEnabled && backupCode) {
    if (!ENCRYPTION_KEY) {
      throw new Error("Encryption key not found");
    }

    if (!user.backupCodes) {
      throw new InvalidInputError("Missing backup codes");
    }

    const backupCodes = JSON.parse(symmetricDecrypt(user.backupCodes, ENCRYPTION_KEY));

    // check if user-supplied code matches one
    const index = backupCodes.indexOf(backupCode.replaceAll("-", ""));
    if (index === -1) {
      throw new InvalidInputError("Incorrect backup code");
    }

    // we delete all stored backup codes at the end, no need to do this here

    // if user has 2fa and NOT using backup code, try totp
  } else if (user.twoFactorEnabled) {
    if (!code) {
      throw new InvalidInputError("Two factor code required");
    }

    if (!user.twoFactorSecret) {
      throw new InvalidInputError("Two factor setup has not been completed");
    }

    if (!ENCRYPTION_KEY) {
      throw new Error("Encryption key not found");
    }

    const secret = symmetricDecrypt(user.twoFactorSecret, ENCRYPTION_KEY);
    if (secret.length !== 32) {
      throw new InvalidInputError("Invalid secret");
    }

    const isValidCode = totpAuthenticatorCheck(code, secret);
    if (!isValidCode) {
      throw new InvalidInputError("Invalid code");
    }
  }

  // Clear both stores together: the legacy User columns and Better Auth's `TwoFactor` row (which login
  // reads). Leaving the BA row behind would keep 2FA effectively on at login (ENG-1824).
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { backupCodes: null, twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.twoFactor.deleteMany({ where: { userId: id } }),
  ]);

  return {
    message: "Two factor authentication disabled",
  };
};
