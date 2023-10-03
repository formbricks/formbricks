import { prisma } from "@formbricks/database";
import {
  TDisplay,
  TDisplayInput,
  TDisplaysWithSurveyName,
  ZDisplayInput,
} from "@formbricks/types/v1/displays";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { cache } from "react";
import { validateInputs } from "../utils/validate";
import { transformPrismaPerson } from "./person";

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
  status: true,
};
export const getDisplayCount = async (surveyId) => {
  const numDisplays = await prisma.display.findMany({
    where: {
      surveyId,
    },
  });
  return numDisplays;
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
        status: "seen",

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

export const getDisplaysOfPerson = cache(
  async (personId: string): Promise<TDisplaysWithSurveyName[] | null> => {
    validateInputs([personId, ZId]);
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
          status: displayPrisma.status,
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
  }
);

export const deleteDisplayByResponseId = async (responseId: string): Promise<void> => {
  validateInputs([responseId, ZId]);
  try {
    await prisma.display.delete({
      where: {
        responseId,
      },
    });
    console.log("deleted");
  } catch (error) {
    console.log(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
