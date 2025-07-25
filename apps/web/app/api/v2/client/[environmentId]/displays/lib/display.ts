import {
  TDisplayCreateInputV2,
  ZDisplayCreateInputV2,
} from "@/app/api/v2/client/[environmentId]/displays/types/display";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { doesContactExist } from "./contact";

export const createDisplay = async (displayInput: TDisplayCreateInputV2): Promise<{ id: string }> => {
  validateInputs([displayInput, ZDisplayCreateInputV2]);

  const { contactId, surveyId, environmentId } = displayInput;

  try {
    const contactExists = contactId ? await doesContactExist(contactId) : false;

    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
        environmentId,
      },
    });
    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const display = await prisma.display.create({
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },

        ...(contactExists && {
          contact: {
            connect: {
              id: contactId,
            },
          },
        }),
      },
      select: { id: true, contactId: true, surveyId: true },
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
