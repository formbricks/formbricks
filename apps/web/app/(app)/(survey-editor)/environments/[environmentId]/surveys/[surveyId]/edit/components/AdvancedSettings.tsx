import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { LogicEditor } from "./LogicEditor";
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
    <div>
      <div className="mb-4">
        <LogicEditor
          question={question}
          updateQuestion={updateQuestion}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          attributeClasses={attributeClasses}
        />
      </div>

      <UpdateQuestionId
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        updateQuestion={updateQuestion}
      />
    </div>
  );
};
