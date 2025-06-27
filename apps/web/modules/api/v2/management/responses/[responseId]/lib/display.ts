import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const deleteDisplay = async (displayId: string): Promise<Result<boolean, ApiErrorResponseV2>> => {
  try {
    await prisma.display.delete({
      where: {
        id: displayId,
      },
      select: {
        id: true,
        contactId: true,
        surveyId: true,
      },
    });

    return ok(true);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
