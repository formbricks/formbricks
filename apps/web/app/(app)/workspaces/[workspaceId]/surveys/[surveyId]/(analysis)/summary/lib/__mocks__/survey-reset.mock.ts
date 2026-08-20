import { TResponseData } from "@formbricks/types/responses";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum, TSurveyFileUploadElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";

export const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";
export const workspaceId = "u8qa6u0tlxb6160pi2jb8s4p";

export const fileUploadElement: TSurveyFileUploadElement = {
  id: "y3ydd3td2iq09wa599cxo1me",
  type: TSurveyElementTypeEnum.FileUpload,
  headline: { default: "Upload your file" },
  required: false,
  allowMultipleFiles: true,
};

export const fileUploadBlock: TSurveyBlock = {
  id: "wq0m4wvvvhmzrxmnzmr6mkuz",
  name: "File upload block",
  elements: [fileUploadElement],
};

/**
 * `collectSurveyResponseFileUrls` reads exactly these three fields off the survey, so the fixtures
 * declare only those — fully typed, so a wrong block or element shape fails typecheck. The single cast
 * to `TSurvey` lives in the mock helper that hands them to `getSurvey`.
 */
export type SurveyFileUploadFields = Pick<TSurvey, "blocks" | "questions" | "workspaceId">;

export const surveyWithFileUpload: SurveyFileUploadFields = {
  blocks: [fileUploadBlock],
  questions: [],
  workspaceId,
};

export const surveyWithoutFileUpload: SurveyFileUploadFields = {
  blocks: [],
  questions: [],
  workspaceId,
};

export const storageUrl = (fileName: string) =>
  `https://example.com/storage/${workspaceId}/private/${fileName}`;

/** One response row as `collectSurveyResponseFileUrls` selects it (`id` + `data` only). */
export type ScannedResponse = { id: string; data: TResponseData };

export const responseWithFiles = (id: string, fileNames: string[]): ScannedResponse => ({
  id,
  data: { [fileUploadElement.id]: fileNames.map(storageUrl) },
});
