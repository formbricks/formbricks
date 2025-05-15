import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { TDisplay, TDisplayFilters } from "@formbricks/types/displays";
import { DatabaseError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { validateInputs } from "../utils/validate";
import { displayCache } from "./cache";

export const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  contactId: true,
  status: true,
} satisfies Prisma.DisplaySelect;

export const getDisplayCountBySurveyId = reactCache(
  async (surveyId: string, filters?: TDisplayFilters): Promise<number> =>
    cache(
      async () => {
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
      },
      [`getDisplayCountBySurveyId-${surveyId}-${JSON.stringify(filters)}`],
      {
        tags: [displayCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const deleteDisplay = async (displayId: string): Promise<TDisplay> => {
  validateInputs([displayId, ZId]);
  try {
    const display = await prisma.display.delete({
      where: {
        id: displayId,
      },
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      contactId: display.contactId,
      surveyId: display.surveyId,
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
