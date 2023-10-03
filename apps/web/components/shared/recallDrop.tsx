"use client";

import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
// import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface RecallDropdownProps {
  localSurvey: TSurveyWithAnalytics;
  questionIdx: number;
  handleRecallItemClick: (question: any) => void;
}

export default function RecallDropdown({
  localSurvey,
  questionIdx,
  handleRecallItemClick,
}: RecallDropdownProps) {
  let recallQuestions: any = [];

  for (let i = 0; i < questionIdx; i++) {
    const question = localSurvey.questions[i];
    recallQuestions.push(question);
  }

  return (
    <div>
      <div>Recall information from ...</div>
      {recallQuestions.map((question) => {
        return (
          <li key={question.id} onClick={() => handleRecallItemClick(question)} style={{ cursor: "pointer" }}>
            {question.headline}
          </li>
        );
      })}
    </div>
  );
}
