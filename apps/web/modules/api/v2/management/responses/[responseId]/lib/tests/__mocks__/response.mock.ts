import { Response, Survey } from "@prisma/client";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const responseId = "goy9hd7uautij04aosslsplb";

export const responseInput: Omit<Response, "id"> = {
  data: { file: "fileUrl" },
  surveyId: "kbr8tnr2q2vgztyrfnqlgfjt",
  displayId: "jowdit1qrf04t97jcc0io9di",
  createdAt: new Date(),
  updatedAt: new Date(),
  finished: true,
  contactAttributes: {},
  contactId: "olwablfltg9eszoh0nz83w02",
  endingId: "i4k59a2m6fk70vwpn2d9b7a7",
  variables: [],
  ttc: {},
  language: "en",
  meta: {},
  singleUseId: "4c02dc5f-eff1-4020-9a9b-a16efd929653",
};

export const response: Response = {
  id: responseId,
  ...responseInput,
};

export const survey: Pick<Survey, "questions" | "environmentId"> = {
  questions: [
    {
      id: "ggaw04zw7gx7uxodk5da7if8",
      type: TSurveyQuestionTypeEnum.FileUpload,
      headline: { en: "Question 1" },
      required: true,
      allowMultipleFiles: true,
    },
  ],
  environmentId: "z5t8e52wy6xvi61ubebs2e4i",
};
