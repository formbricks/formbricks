import { deleteDisplay } from "@/modules/api/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/management/responses/[responseId]/lib/utilts";
import { TResponseDelete } from "@/modules/api/management/responses/[responseId]/types/responses";
import { Prisma, Tag } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const deleteResponse = async (responseId: string): Promise<TResponseDelete> => {
  try {
    const responsePrisma = await prisma.response.delete({
      where: {
        id: responseId,
      },
      include: {
        contact: {
          select: {
            id: true,
            userId: true,
          },
        },
        notes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const { contact, ...rest } = responsePrisma;

    const response: TResponseDelete = {
      ...rest,
      ...(contact ? contact : {}),
      tags: responsePrisma.tags.map((tagPrisma: { tag: Tag }) => tagPrisma.tag),
    };

    if (response.displayId) {
      deleteDisplay(response.displayId);
    }
    const survey = await getSurveyQuestions(response.surveyId);

    if (survey) {
      await findAndDeleteUploadedFilesInResponse(response.data, survey.questions);
    }

    responseCache.revalidate({
      environmentId: survey?.environmentId,
      id: response.id,
      contactId: response.contact?.id,
      surveyId: response.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: response.id,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
