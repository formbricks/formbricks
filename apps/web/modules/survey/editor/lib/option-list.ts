import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TOptionList, TOptionListInput } from "@formbricks/types/option-list";

export const getOptionListsByProjectId = async (projectId: string): Promise<TOptionList[]> => {
  try {
    const optionLists = await prisma.optionList.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });

    return optionLists;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createOptionList = async (projectId: string, data: TOptionListInput): Promise<TOptionList> => {
  try {
    const optionList = await prisma.optionList.create({
      data: {
        projectId,
        name: data.name,
        options: data.options,
      },
    });

    return optionList;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteOptionList = async (id: string): Promise<void> => {
  try {
    await prisma.optionList.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
