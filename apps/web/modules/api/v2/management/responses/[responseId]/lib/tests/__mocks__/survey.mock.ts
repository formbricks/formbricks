import { Survey } from "@prisma/client";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const survey: Pick<Survey, "id" | "questions"> = {
  id: "rp2di001zicbm3mk8je1ue9u",
  questions: [
    {
      id: "i0e9y9ya4pl9iyrurlrak3yq",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question Text", de: "Fragetext" },
      required: false,
      inputType: "text",
      charLimit: {
        enabled: false,
      },
    },
  ],
};
