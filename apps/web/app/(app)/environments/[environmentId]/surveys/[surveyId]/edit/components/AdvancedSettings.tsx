import LogicEditor from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LogicEditor";

import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";

import UpdateQuestionId from "./UpdateQuestionId";

interface AdvancedSettingsProps {
  question: TSurveyQuestion;
  questionIdx: number;
  localSurvey: TSurvey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  defaultLanguageSymbol: string;
}

export default function AdvancedSettings({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
  defaultLanguageSymbol,
}: AdvancedSettingsProps) {
  return (
    <div>
      <div className="mb-4">
        <LogicEditor
          question={question}
          updateQuestion={updateQuestion}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          defaultLanguageSymbol={defaultLanguageSymbol}
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
}
