import { Response, Survey } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { deleteFile } from "@/modules/storage/service";
import { parseStorageFileUrl } from "@/modules/storage/utils";

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
      const storageFile = parseStorageFileUrl(fileUrl);

      if (!storageFile) {
        throw new Error(`Invalid storage file URL: ${fileUrl}`);
      }
      return deleteFile(storageFile.storageId, storageFile.accessType, storageFile.fileName, workspaceId);
    } catch (error) {
      logger.error({ error, fileUrl }, "Failed to delete file");
    }
  });

  await Promise.all(deletionPromises);

  return okVoid();
};
