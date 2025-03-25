import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Response, Survey } from "@prisma/client";
import { deleteFile } from "@formbricks/lib/storage/service";
import { logger } from "@formbricks/logger";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const findAndDeleteUploadedFilesInResponse = async (
  responseData: Response["data"],
  questions: Survey["questions"]
): Promise<Result<void, ApiErrorResponseV2>> => {
  const fileUploadQuestions = new Set(
    questions.filter((question) => question.type === TSurveyQuestionTypeEnum.FileUpload).map((q) => q.id)
  );

  const fileUrls = Object.entries(responseData)
    .filter(([questionId]) => fileUploadQuestions.has(questionId))
    .flatMap(([, questionResponse]) => questionResponse as string[]);

  const deletionPromises = fileUrls.map(async (fileUrl) => {
    try {
      const { pathname } = new URL(fileUrl);
      const [, environmentId, accessType, fileName] = pathname.split("/").filter(Boolean);

      if (!environmentId || !accessType || !fileName) {
        throw new Error(`Invalid file path: ${pathname}`);
      }
      return deleteFile(environmentId, accessType as "private" | "public", fileName);
    } catch (error) {
      logger.error({ error, fileUrl }, "Failed to delete file");
    }
  });

  await Promise.all(deletionPromises);

  return okVoid();
};
