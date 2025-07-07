import {
  TDisplayCreateInputV2,
  ZDisplayCreateInputV2,
} from "@/app/api/v2/client/[environmentId]/displays/types/display";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { doesContactExist } from "./contact";

export const createDisplay = async (displayInput: TDisplayCreateInputV2): Promise<{ id: string }> => {
  validateInputs([displayInput, ZDisplayCreateInputV2]);

  const { contactId, surveyId } = displayInput;

  try {
    const contactExists = contactId ? await doesContactExist(contactId) : false;

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
      if (error.code === PrismaErrorType.RelatedRecordDoesNotExist) {
        throw new InvalidInputError(`The survey with id ${surveyId} does not exist.`);
      }
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
