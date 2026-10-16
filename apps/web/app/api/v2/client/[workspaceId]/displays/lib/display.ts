import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TDisplayCreateInputV2,
  ZDisplayCreateInputV2,
} from "@/app/api/v2/client/[workspaceId]/displays/types/display";
import { validateInputs } from "@/lib/utils/validate";
import { getCreativeAttribution } from "@/modules/creatives/lib/attribution";
import { doesContactExistInWorkspace } from "./contact";

export const createDisplay = async (displayInput: TDisplayCreateInputV2): Promise<{ id: string }> => {
  validateInputs([displayInput, ZDisplayCreateInputV2]);

  const { contactId, surveyId, workspaceId, creativeId } = displayInput;

  try {
    const contactExists = contactId ? await doesContactExistInWorkspace(contactId, workspaceId) : false;

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

        ...(contactExists && {
          contact: {
            connect: {
              id: contactId,
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
