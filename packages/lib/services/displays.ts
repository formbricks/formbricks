import { prisma } from "@formbricks/database";
import { TDisplay, TDisplayInput, TDisplaysWithSurveyName } from "@formbricks/types/v1/displays";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { transformPrismaPerson } from "./person";

const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  person: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
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

export const createDisplay = async (displayInput: TDisplayInput): Promise<TDisplay> => {
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

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const markDisplayResponded = async (displayId: string): Promise<TDisplay> => {
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

export const getDisplaysOfPerson = async (personId: string): Promise<TDisplaysWithSurveyName[] | null> => {
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
