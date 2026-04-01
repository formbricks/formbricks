import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { hashPassword } from "../../lib/auth";

const main = async () => {
  const [token, password] = process.argv.slice(2);

  if (!token || !password) {
    throw new Error("Expected token and password arguments");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const hashedPassword = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      select: {
        userId: true,
        expiresAt: true,
      },
    });

    if (!resetToken || resetToken.expiresAt <= now) {
      throw new Error("Invalid or expired password reset token");
    }

    const consumedTokenCount = await tx.passwordResetToken.deleteMany({
      where: {
        tokenHash,
        expiresAt: {
          gt: now,
        },
      },
    });

    if (consumedTokenCount.count !== 1) {
      throw new Error("Password reset token could not be consumed");
    }

    await tx.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    await tx.session.deleteMany({
      where: {
        userId: resetToken.userId,
      },
    });
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
