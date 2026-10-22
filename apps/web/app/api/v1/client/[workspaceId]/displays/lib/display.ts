import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { TDisplayCreateInput, ZDisplayCreateInput } from "@formbricks/types/displays";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getCreativeAttribution } from "@/modules/ee/creatives/lib/attribution";
import { getContactByUserId } from "./contact";

export const createDisplay = async (displayInput: TDisplayCreateInput): Promise<{ id: string }> => {
  validateInputs([displayInput, ZDisplayCreateInput]);

  const { workspaceId, userId, surveyId, creativeId } = displayInput;

  try {
    let contact: { id: string } | null = null;
    if (userId) {
      contact = await getContactByUserId(workspaceId, userId);
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            workspaceId,
            attributes: {
              create: {
                attributeKey: {
                  connect: { key_workspaceId: { key: "userId", workspaceId } },
                },
                value: userId,
              },
            },
          },
        });
      }
    }

    // Status only: this runs once per survey shown, so it never loads the survey's content or its
    // stored custom CSS. The creative lookup only runs when a creative's click opened the survey.
    const [survey, openedBy] = await Promise.all([
      prisma.survey.findUnique({
        where: {
          id: surveyId,
          workspaceId,
        },
        select: { status: true },
      }),
      creativeId ? getCreativeAttribution({ creativeId, workspaceId, surveyId }) : null,
    ]);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    if (survey.status !== "inProgress") {
      throw new InvalidInputError("Survey is not accepting submissions");
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
        ...(openedBy && { creativeId: openedBy.id }),
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
