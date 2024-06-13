import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";
import { LogicEditor } from "./LogicEditor";
import { MetadataEditor } from "./MetadataEditor";
import { RequirementsLogicEditor } from "./RequirementsLogicEditor";
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

      <div className="mb-4">
        <RequirementsLogicEditor
          question={question}
          updateQuestion={updateQuestion}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          attributeClasses={attributeClasses}
        />
      </div>

      <div className="mb-4">
        <MetadataEditor
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
