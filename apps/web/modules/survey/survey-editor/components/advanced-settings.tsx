import { ConditionalLogic } from "@/modules/survey/survey-editor/components/conditional-logic";
import { UpdateQuestionId } from "@/modules/survey/survey-editor/components/update-question-id";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface AdvancedSettingsProps {
  question: TSurveyQuestion;
  questionIdx: number;
  localSurvey: TSurvey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  contactAttributeKeys: TContactAttributeKey[];
}

export const AdvancedSettings = ({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
  contactAttributeKeys,
}: AdvancedSettingsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <ConditionalLogic
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        contactAttributeKeys={contactAttributeKeys}
      />

      <UpdateQuestionId
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        updateQuestion={updateQuestion}
      />
    </div>
  );
};
