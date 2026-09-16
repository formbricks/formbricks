import { Response, Survey } from "@formbricks/database/prisma";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { collectResponseFileUrls, getSurveyFileUploadElementIds } from "@/modules/storage/utils";

export const findAndDeleteUploadedFilesInResponse = async (
  responseData: Response["data"],
  survey: Pick<Survey, "blocks" | "questions">,
  workspaceId?: string
): Promise<Result<void, ApiErrorResponseV2>> => {
  const fileUrls = collectResponseFileUrls(responseData, getSurveyFileUploadElementIds(survey));

  await deleteResponseFileUrls(fileUrls, workspaceId);

  return okVoid();
};
