import { createHash } from "crypto";
import { prisma } from "@formbricks/database";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const hasOwnership = async (model, session, id) => {
  try {
    const entity = await prisma[model].findUnique({
      where: { id: id },
      include: {
        user: {
          select: { email: true },
        },
      },
    });
    if (entity.user.email === session.user.email) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error(`can't verify ownership: ${e}`);
    return false;
  }
};
