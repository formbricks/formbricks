import { Survey } from "@prisma/client";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const survey: Pick<Survey, "id" | "questions" | "blocks"> = {
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
  blocks: [
    {
      id: "block1",
      name: "Block 1",
      elements: [
        {
          id: "i0e9y9ya4pl9iyrurlrak3yq",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "Question Text", de: "Fragetext" },
          required: false,
          inputType: "text",
          charLimit: 1000,
          subheader: { default: "" },
          placeholder: { default: "" },
        },
      ],
    },
  ],
};
