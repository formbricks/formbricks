import { Response, Survey } from "@prisma/client";
import { logger } from "@formbricks/logger";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { deleteFile } from "@/modules/storage/service";

export const findAndDeleteUploadedFilesInResponse = async (
  responseData: Response["data"],
  questions: Survey["questions"],
  workspaceId?: string
): Promise<Result<void, ApiErrorResponseV2>> => {
  const fileUploadQuestions = new Set(
    questions
      .filter(
        (question: { type: string; id: string }) => question.type === TSurveyQuestionTypeEnum.FileUpload
      )
      .map((q: { type: string; id: string }) => q.id)
  );

  const fileUrls = Object.entries(responseData)
    .filter(([questionId]) => fileUploadQuestions.has(questionId))
    .flatMap(([, questionResponse]) => questionResponse as string[]);

  const deletionPromises = fileUrls.map(async (fileUrl) => {
    try {
      const pathname = fileUrl.startsWith("/storage/") ? fileUrl : new URL(fileUrl).pathname;
      const [, storageId, accessType, ...fileNameSegments] = pathname.split("/").filter(Boolean);
      const fileName = fileNameSegments.join("/");

      if (!storageId || !accessType || !fileName) {
        throw new Error(`Invalid file path: ${pathname}`);
      }
      return deleteFile(storageId, accessType as "private" | "public", fileName, workspaceId);
    } catch (error) {
      logger.error({ error, fileUrl }, "Failed to delete file");
    }
  });

  await Promise.all(deletionPromises);

  return okVoid();
};
