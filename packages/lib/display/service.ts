import "server-only";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import {
  TDisplay,
  TDisplayCreateInput,
  TDisplayUpdateInput,
  TDisplaysWithSurveyName,
  ZDisplayCreateInput,
  ZDisplayUpdateInput,
} from "@formbricks/types/displays";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { transformPrismaPerson } from "../person/service";
import { validateInputs } from "../utils/validate";
import { displayCache } from "./cache";
import { formatDisplaysDateFields } from "./util";
import { responseCache } from "../response/cache";

const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  responseId: true,
  person: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      environmentId: true,
      attributes: {
        select: {
          value: true,
          attributeClass: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
};

export const updateDisplay = async (
  displayId: string,
  displayInput: Partial<TDisplayUpdateInput>
): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayUpdateInput.partial()]);
  try {
    const displayPrisma = await prisma.display.update({
      where: {
        id: displayId,
      },
      data: displayInput,
      select: selectDisplay,
    });
    const display: TDisplay = {
      ...displayPrisma,
      person: displayPrisma.person ? transformPrismaPerson(displayPrisma.person) : null,
    };

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
    const displayPrisma = await prisma.display.create({
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

    const display: TDisplay = {
      ...displayPrisma,
      person: displayPrisma.person ? transformPrismaPerson(displayPrisma.person) : null,
    };

    displayCache.revalidate({
      id: display.id,
      personId: display.person?.id,
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

    const displayPrisma = await prisma.display.update({
      where: {
        id: displayId,
      },
      data: {
        status: "responded",
      },
      select: selectDisplay,
    });

    if (!displayPrisma) {
      throw new ResourceNotFoundError("Display", displayId);
    }

    const display: TDisplay = {
      ...displayPrisma,
      person: displayPrisma.person ? transformPrismaPerson(displayPrisma.person) : null,
    };

    displayCache.revalidate({
      id: display.id,
      personId: display.person?.id,
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

export const getDisplaysByPersonId = async (
  personId: string,
  page?: number
): Promise<TDisplaysWithSurveyName[]> => {
  const displays = await unstable_cache(
    async () => {
      validateInputs([personId, ZId], [page, ZOptionalNumber]);

      try {
        const displaysPrisma = await prisma.display.findMany({
          where: {
            personId: personId,
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            surveyId: true,
            responseId: true,
            survey: {
              select: {
                name: true,
              },
            },
            status: true,
          },
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          orderBy: {
            createdAt: "desc",
          },
        });

        if (!displaysPrisma) {
          throw new ResourceNotFoundError("Display from PersonId", personId);
        }

        let displays: TDisplaysWithSurveyName[] = [];

        displaysPrisma.forEach((displayPrisma) => {
          const display: TDisplaysWithSurveyName = {
            id: displayPrisma.id,
            createdAt: displayPrisma.createdAt,
            updatedAt: displayPrisma.updatedAt,
            person: null,
            surveyId: displayPrisma.surveyId,
            surveyName: displayPrisma.survey.name,
            responseId: displayPrisma.responseId,
          };
          displays.push(display);
        });

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
    const deletedDisplay = await prisma.display.delete({
      where: {
        responseId,
      },
      select: selectDisplay,
    });

    const display: TDisplay = {
      ...deletedDisplay,
      person: deletedDisplay.person ? transformPrismaPerson(deletedDisplay.person) : null,
    };

    displayCache.revalidate({
      id: display.id,
      personId: display.person?.id,
      surveyId,
    });

    responseCache.revalidate({
      responseId,
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
        const displayCount = await prisma.response.count({
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
