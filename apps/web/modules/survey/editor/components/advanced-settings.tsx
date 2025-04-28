import { ConditionalLogic } from "@/modules/survey/editor/components/conditional-logic";
import { UpdateQuestionId } from "@/modules/survey/editor/components/update-question-id";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface AdvancedSettingsProps {
  question: TSurveyQuestion;
  questionIdx: number;
  localSurvey: TSurvey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

export const AdvancedSettings = ({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
}: AdvancedSettingsProps) => {
  // [UseTusk]

  return (
    <div className="flex flex-col gap-4">
      <ConditionalLogic
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
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
