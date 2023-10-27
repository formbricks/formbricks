import "server-only";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import {
  TDisplay,
  TDisplayCreateInput,
  TDisplayUpdateInput,
  ZDisplayCreateInput,
  ZDisplayUpdateInput,
} from "@formbricks/types/displays";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { validateInputs } from "../utils/validate";
import { displayCache } from "./cache";
import { formatDisplaysDateFields } from "./util";

const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  responseId: true,
  personId: true,
};

export const updateDisplay = async (
  displayId: string,
  displayInput: Partial<TDisplayUpdateInput>
): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayUpdateInput.partial()]);
  try {
    const data = {
      ...(displayInput.personId && {
        person: {
          connect: {
            id: displayInput.personId,
          },
        },
      }),
      ...(displayInput.responseId && {
        responseId: displayInput.responseId,
      }),
    };
    const display = await prisma.display.update({
      where: {
        id: displayId,
      },
      data,
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      surveyId: display.surveyId,
    });

    return display;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const createDisplay = async (displayInput: TDisplayCreateInput): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayCreateInput]);
  try {
    const display = await prisma.display.create({
      data: {
        survey: {
          connect: {
            id: displayInput.surveyId,
          },
        },

        ...(displayInput.personId && {
          person: {
            connect: {
              id: displayInput.personId,
            },
          },
        }),
      },
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
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

export const markDisplayResponded = async (displayId: string): Promise<TDisplay> => {
  validateInputs([displayId, ZId]);

  try {
    if (!displayId) throw new Error("Display ID is required");

    const display = await prisma.display.update({
      where: {
        id: displayId,
      },
      data: {
        status: "responded",
      },
      select: selectDisplay,
    });

    if (!display) {
      throw new ResourceNotFoundError("Display", displayId);
    }

    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
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

export const getDisplaysByPersonId = async (personId: string, page?: number): Promise<TDisplay[]> => {
  const displays = await unstable_cache(
    async () => {
      validateInputs([personId, ZId], [page, ZOptionalNumber]);

      try {
        const displays = await prisma.display.findMany({
          where: {
            personId: personId,
          },
          select: selectDisplay,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          orderBy: {
            createdAt: "desc",
          },
        });

        if (!displays) {
          throw new ResourceNotFoundError("Display from PersonId", personId);
        }

        return displays;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getDisplaysByPersonId-${personId}-${page}`],
    {
      tags: [displayCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return formatDisplaysDateFields(displays);
};

export const deleteDisplayByResponseId = async (responseId: string, surveyId: string): Promise<TDisplay> => {
  validateInputs([responseId, ZId], [surveyId, ZId]);

  try {
    const display = await prisma.display.delete({
      where: {
        responseId,
      },
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
      surveyId,
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDisplayCountBySurveyId = async (surveyId: string): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);

      try {
        const displayCount = await prisma.display.count({
          where: {
            surveyId: surveyId,
          },
        });
        return displayCount;
      } catch (error) {
        throw error;
      }
    },
    [`getDisplayCountBySurveyId-${surveyId}`],
    {
      tags: [displayCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getMonthlyDisplayCount = async (environmentId: string): Promise<number> =>
  await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return (
        await prisma.display.aggregate({
          _count: {
            id: true,
          },
          where: {
            survey: {
              environmentId: environmentId,
              type: "web",
            },
            createdAt: {
              gte: firstDayOfMonth,
            },
          },
        })
      )._count.id;
    },
    [`getMonthlyDisplayCount-${environmentId}`],
    {
      tags: [displayCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
