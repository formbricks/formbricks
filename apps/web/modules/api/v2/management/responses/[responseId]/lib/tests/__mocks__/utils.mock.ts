import { Response, Survey } from "@prisma/client";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const environmentId = "u8qa6u0tlxb6160pi2jb8s4p";

export const openTextQuestion: Survey["questions"][number] = {
  id: "y3ydd3td2iq09wa599cxo1md",
  type: TSurveyQuestionTypeEnum.OpenText,
  charLimit: {
    enabled: true,
  },
  inputType: "text",
  required: true,
  headline: { en: "Open Text Question" },
};

export const fileUploadQuestion: Survey["questions"][number] = {
  id: "y3ydd3td2iq09wa599cxo1me",
  type: TSurveyQuestionTypeEnum.FileUpload,
  headline: { en: "File Upload Question" },
  required: true,
  allowMultipleFiles: true,
  buttonLabel: { en: "Upload" },
};

export const responseData: Response["data"] = {
  [openTextQuestion.id]: "Open Text Answer",
  [fileUploadQuestion.id]: [
    `https://example.com/dummy/${environmentId}/private/file1.png`,
    `https://example.com/dummy/${environmentId}/private/file2.pdf`,
  ],
};
