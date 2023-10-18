import "server-only";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/v1/common";
import {
  TDisplay,
  TDisplayInput,
  TDisplaysWithSurveyName,
  ZDisplayInput,
} from "@formbricks/types/v1/displays";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { transformPrismaPerson } from "../person/service";
import { validateInputs } from "../utils/validate";

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
  displayInput: Partial<TDisplayInput>
): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayInput.partial()]);
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

    return display;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
export const getDisplaysCacheTag = (surveyId: string) => `surveys-${surveyId}-displays`;

export const createDisplay = async (displayInput: TDisplayInput): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayInput]);
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

    if (displayInput.personId) {
      revalidateTag(displayInput.personId);
    }

    if (displayInput.surveyId) {
      revalidateTag(getDisplaysCacheTag(displayInput.surveyId));
    }

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
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

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getDisplaysOfPerson = async (
  personId: string,
  page?: number
): Promise<TDisplaysWithSurveyName[] | null> => {
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
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const deleteDisplayByResponseId = async (responseId: string, surveyId: string): Promise<void> => {
  validateInputs([responseId, ZId]);
  try {
    await prisma.display.delete({
      where: {
        responseId,
      },
    });
    revalidateTag(getDisplaysCacheTag(surveyId));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
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
      tags: [getDisplaysCacheTag(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
