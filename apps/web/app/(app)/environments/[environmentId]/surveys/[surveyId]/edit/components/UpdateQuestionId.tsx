"use client";

import { TSurvey, TSurveyQuestion } from "@formbricks/types/v1/surveys";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { useState } from "react";
import toast from "react-hot-toast";

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
    if (questionIds.includes(currentValue)) {
      setIsInputInvalid(true);
      toast.error("IDs have to be unique per survey.");
    } else if (currentValue.trim() === "" || currentValue.includes(" ")) {
      setCurrentValue(prevValue);
      updateQuestion(questionIdx, { id: prevValue });
      toast.error("ID should not be empty.");
      return;
    } else {
      setIsInputInvalid(false);
      toast.success("Question ID updated.");
    }

    updateQuestion(questionIdx, { id: currentValue });
    setPrevValue(currentValue); // after successful update, set current value as previous value
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
            localSurvey.hiddenFields?.fieldIds?.forEach((field) => {
              if (field === e.target.value) {
                setIsInputInvalid(true);
                toast.error("QuestionID can't be equal to hidden fields");
              }
            });
          }}
          onBlur={saveAction}
          disabled={!(localSurvey.status === "draft" || question.isDraft)}
          className={isInputInvalid ? "border-red-300 focus:border-red-300" : ""}
        />
      </div>
    </div>
  );
}
