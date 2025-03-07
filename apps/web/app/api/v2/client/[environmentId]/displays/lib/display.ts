import {
  TDisplayCreateInputV2,
  ZDisplayCreateInputV2,
} from "@/app/api/v2/client/[environmentId]/displays/types/display";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { displayCache } from "@formbricks/lib/display/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { DatabaseError } from "@formbricks/types/errors";
import { getContact } from "./contact";

export const createDisplay = async (displayInput: TDisplayCreateInputV2): Promise<{ id: string }> => {
  validateInputs([displayInput, ZDisplayCreateInputV2]);

  const { environmentId, contactId, surveyId } = displayInput;

  try {
    let contact: { id: string } | null = null;
    if (contactId) {
      contact = await getContact(contactId);
    }

    const display = await prisma.display.create({
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },

        ...(contact && {
          contact: {
            connect: {
              id: contact.id,
            },
          },
        }),
      },
      select: { id: true, contactId: true, surveyId: true },
    });

    displayCache.revalidate({
      id: display.id,
      contactId: display.contactId,
      surveyId: display.surveyId,
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
