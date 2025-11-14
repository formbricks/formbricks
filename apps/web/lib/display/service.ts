import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/generated/client";
import { ZId } from "@formbricks/types/common";
import { TDisplay, TDisplayFilters } from "@formbricks/types/displays";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";

export const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  contactId: true,
} satisfies Prisma.DisplaySelect;

export const getDisplayCountBySurveyId = reactCache(
  async (surveyId: string, filters?: TDisplayFilters): Promise<number> => {
    validateInputs([surveyId, ZId]);

    try {
      const displayCount = await prisma.display.count({
        where: {
          surveyId: surveyId,
          ...(filters &&
            filters.createdAt && {
              createdAt: {
                gte: filters.createdAt.min,
                lte: filters.createdAt.max,
              },
            }),
        },
      });
      return displayCount;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

// Use any for transaction client to avoid dist/src type mismatch in TypeScript
// Runtime behavior is correct, this is purely a type resolution issue
export const deleteDisplay = async (displayId: string, tx?: any): Promise<TDisplay> => {
  validateInputs([displayId, ZId]);
  try {
    const prismaClient = tx ?? prisma;
    const display = await prismaClient.display.delete({
      where: {
        id: displayId,
      },
      select: selectDisplay,
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
