import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { userCache } from "@formbricks/lib/user/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TUserUpdateInput, ZUserUpdateInput } from "@formbricks/types/user";

export const updateUser = async (id: string, data: TUserUpdateInput) => {
  validateInputs([id, ZId], [data, ZUserUpdateInput.partial()]);

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: data,
      select: {
        id: true,
        email: true,
        locale: true,
      },
    });

    userCache.revalidate({
      email: updatedUser.email,
      id: updatedUser.id,
    });

    return updatedUser;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("User", id);
    }
    throw error; // Re-throw any other errors
  }
};
