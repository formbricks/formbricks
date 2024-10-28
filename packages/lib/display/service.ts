import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import {
  TDisplay,
  TDisplayCreateInput,
  TDisplayFilters,
  ZDisplayCreateInput,
} from "@formbricks/types/displays";
import { DatabaseError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { createPerson, getPersonByUserId } from "../person/service";
import { validateInputs } from "../utils/validate";
import { displayCache } from "./cache";

export const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  personId: true,
  status: true,
};

export const getDisplay = reactCache(
  async (displayId: string): Promise<TDisplay | null> =>
    cache(
      async () => {
        validateInputs([displayId, ZId]);

        try {
          const display = await prisma.display.findUnique({
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
      },
      [`getDisplay-${displayId}`],
      {
        tags: [displayCache.tag.byId(displayId)],
      }
    )()
);

export const createDisplay = async (displayInput: TDisplayCreateInput): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayCreateInput]);

  const { environmentId, userId, surveyId } = displayInput;
  try {
    let person;
    if (userId) {
      person = await getPersonByUserId(environmentId, userId);
      if (!person) {
        person = await createPerson(environmentId, userId);
      }
    }
    const display = await prisma.display.create({
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },

        ...(person && {
          person: {
            connect: {
              id: person.id,
            },
          },
        }),
      },
      select: selectDisplay,
    });
    displayCache.revalidate({
      id: display.id,
      contactId: display.personId,
      surveyId: display.surveyId,
      userId,
      environmentId,
    });
    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getDisplaysByContactId = reactCache(
  async (contactId: string, page?: number): Promise<TDisplay[]> =>
    cache(
      async () => {
        validateInputs([contactId, ZId], [page, ZOptionalNumber]);

        try {
          const displays = await prisma.display.findMany({
            where: {
              contactId,
            },
            select: selectDisplay,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
            orderBy: {
              createdAt: "desc",
            },
          });

          return displays;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getDisplaysByContactId-${contactId}-${page}`],
      {
        tags: [displayCache.tag.byContactId(contactId)],
      }
    )()
);

export const getDisplayCountBySurveyId = reactCache(
  (surveyId: string, filters?: TDisplayFilters): Promise<number> =>
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
              ...(filters &&
                filters.responseIds && {
                  responseId: {
                    in: filters.responseIds,
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
      contactId: display.personId,
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
