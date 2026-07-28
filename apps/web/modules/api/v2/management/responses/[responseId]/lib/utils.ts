import { Response, Survey } from "@formbricks/database/prisma";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";

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

  await deleteResponseFileUrls(fileUrls, workspaceId);

  return okVoid();
};
