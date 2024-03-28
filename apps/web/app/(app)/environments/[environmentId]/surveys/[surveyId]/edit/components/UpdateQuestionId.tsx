"use client";

import { validateId } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/lib/validation";
import { useState } from "react";
import toast from "react-hot-toast";

import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface UpdateQuestionIdProps {
  localSurvey: TSurvey;
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

export default function UpdateQuestionId({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: UpdateQuestionIdProps) {
  const [currentValue, setCurrentValue] = useState(question.id);
  const [prevValue, setPrevValue] = useState(question.id);
  const [isInputInvalid, setIsInputInvalid] = useState(
    currentValue.trim() === "" || currentValue.includes(" ")
  );

  const saveAction = () => {
    // return early if the input value was not changed
    if (currentValue === prevValue) {
      return;
    }

    const questionIds = localSurvey.questions.map((q) => q.id);
    const hiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];
    if (validateId("Question", currentValue, questionIds, hiddenFieldIds)) {
      setIsInputInvalid(false);
      toast.success("Question ID updated.");
      updateQuestion(questionIdx, { id: currentValue });
      setPrevValue(currentValue); // after successful update, set current value as previous value
    } else {
      setCurrentValue(prevValue);
    }
  };

  return (
    <div>
      <Label htmlFor="questionId">Question ID</Label>
      <div className="mt-2 inline-flex w-full">
        <Input
          id="questionId"
          name="questionId"
          value={currentValue}
          onChange={(e) => {
            setCurrentValue(e.target.value);
          }}
          onBlur={saveAction}
          disabled={!(localSurvey.status === "draft" || question.isDraft)}
          className={isInputInvalid ? "border-red-300 focus:border-red-300" : ""}
        />
      </div>
    </div>
  );
}
