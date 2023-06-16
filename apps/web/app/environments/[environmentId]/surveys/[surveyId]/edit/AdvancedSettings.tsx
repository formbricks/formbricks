import React from "react";
import LogicEditor from "@/app/environments/[environmentId]/surveys/[surveyId]/edit/LogicEditor";
import UpdateQuestionId from "./UpdateQuestionId";
import { Question } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";

interface AdvancedSettingsProps {
  question: Question;
  questionIdx: number;
  localSurvey: Survey;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

export default function AdvancedSettings({
  question,
  questionIdx,
  localSurvey,
  updateQuestion,
}: AdvancedSettingsProps) {
  return (
    <div>
      <div className="mb-4">
        <LogicEditor
          question={question}
          updateQuestion={updateQuestion}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
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
