import {prisma} from "@formbricks/database";
import { TDisplay, TDisplayInput } from "@formbricks/types/v1/displays";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { transformPrismaPerson } from "./person";

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
        
        ...(displayInput.personId &&
          {
              person: {
                connect: {
                  id: displayInput.personId,
                },
              },
            }
          ),
        
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        person: {
          select: {
            id: true,
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
      },
    });

    const display: TDisplay = {
      ...displayPrisma,
      person: transformPrismaPerson(displayPrisma.person),
    };

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};



export const updateDisplay = async (displayId: string): Promise<TDisplay> => {
  try {

    if(!displayId) throw new Error("Display ID is required");
    
    const displayPrisma = await prisma.display.update({
      where: {
        id: displayId,
      },
      data: {
        status: "responded",
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        person: {
          select: {
            id: true,
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
      },
    });

    if (!displayPrisma) {
      throw new ResourceNotFoundError("Display", displayId);
    }

    const display: TDisplay = {
      ...displayPrisma,
      person: transformPrismaPerson(displayPrisma.person),
    };

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};



