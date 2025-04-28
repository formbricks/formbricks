import { displayCache } from "@/lib/display/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TDisplayCreateInput, ZDisplayCreateInput } from "@formbricks/types/displays";
import { DatabaseError } from "@formbricks/types/errors";
import { getContactByUserId } from "./contact";

export const createDisplay = async (displayInput: TDisplayCreateInput): Promise<{ id: string }> => {
  validateInputs([displayInput, ZDisplayCreateInput]);

  const { environmentId, userId, surveyId } = displayInput;

  try {
    let contact: { id: string } | null = null;
    if (userId) {
      contact = await getContactByUserId(environmentId, userId);
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            environment: { connect: { id: environmentId } },
            attributes: {
              create: {
                attributeKey: {
                  connect: { key_environmentId: { key: "userId", environmentId } },
                },
                value: userId,
              },
            },
          },
        });
      }
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
