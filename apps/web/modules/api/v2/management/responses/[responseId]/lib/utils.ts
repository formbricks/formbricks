import { Response, Survey } from "@formbricks/database/prisma";
import { Result, okVoid } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { getSurveyFileUploadConfigs } from "@/modules/storage/utils";

export const findAndDeleteUploadedFilesInResponse = async (
  responseData: Response["data"],
  survey: Pick<Survey, "blocks" | "questions">,
  workspaceId?: string
): Promise<Result<void, ApiErrorResponseV2>> => {
  // A survey holds file uploads in either blocks or questions, so build the id set from the union of
  // both — the same source write-time validation uses. A questions-only set silently skipped deletes
  // for block-based surveys (the common shape), leaking their uploads.
  const fileUploadElementIds = new Set(
    getSurveyFileUploadConfigs({
      blocks: survey.blocks,
      questions: survey.questions,
    }).map((config) => config.id)
  );

  const fileUrls = Object.entries(responseData)
    .filter(([elementId]) => fileUploadElementIds.has(elementId))
    .flatMap(([, elementResponse]) => elementResponse as string[]);

  await deleteResponseFileUrls(fileUrls, workspaceId);

  return okVoid();
};
