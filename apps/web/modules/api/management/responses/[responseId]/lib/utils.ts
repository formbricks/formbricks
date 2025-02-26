import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { Response, Survey } from "@prisma/client";
import { deleteFile } from "@formbricks/lib/storage/service";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const findAndDeleteUploadedFilesInResponse = async (
  responseData: Response["data"],
  questions: Survey["questions"]
): Promise<Result<void, ApiErrorResponse>> => {
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
      console.error(`Failed to delete file ${fileUrl}:`, error);
    }
  });

  await Promise.all(deletionPromises);

  return okVoid();
};
