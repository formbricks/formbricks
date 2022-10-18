import { prisma } from "@formbricks/database";

export const formHasOwnership = async (session, formId) => {
  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        owner: {
          select: { email: true },
        },
      },
    });
    if (form.owner.email === session.user.email) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error(`can't verify ownership: ${e}`);
    return false;
  }
};
