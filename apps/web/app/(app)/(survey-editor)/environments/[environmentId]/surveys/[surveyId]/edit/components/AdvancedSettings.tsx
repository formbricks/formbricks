import { ConditionalLogic } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/ConditionalLogic";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { UpdateQuestionId } from "./UpdateQuestionId";

interface AdvancedSettingsProps {
  question: TSurveyQuestion;
  questionIdx: number;
  localSurvey: TSurvey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  attributeClasses: TAttributeClass[];
}

export const AdvancedSettings = ({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
  attributeClasses,
}: AdvancedSettingsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <ConditionalLogic
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        attributeClasses={attributeClasses}
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
