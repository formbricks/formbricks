import React from "react";
import LogicEditor from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/LogicEditor";
import UpdateQuestionId from "./UpdateQuestionId";
import { TSurveyQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";

interface AdvancedSettingsProps {
  question: TSurveyQuestion;
  questionIdx: number;
  localSurvey: TSurveyWithAnalytics;
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
