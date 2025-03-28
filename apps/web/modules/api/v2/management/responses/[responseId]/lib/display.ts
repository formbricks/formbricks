import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { displayCache } from "@formbricks/lib/display/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const deleteDisplay = async (displayId: string): Promise<Result<boolean, ApiErrorResponseV2>> => {
  try {
    const display = await prisma.display.delete({
      where: {
        id: displayId,
      },
      select: {
        id: true,
        contactId: true,
        surveyId: true,
      },
    });

    displayCache.revalidate({
      id: display.id,
      contactId: display.contactId,
      surveyId: display.surveyId,
    });

    return ok(true);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "display", issue: "not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "display", issue: error.message }],
    });
  }
};
