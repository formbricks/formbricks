"use client";

import { Button, Input, Label } from "@formbricks/ui";
import { CheckIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import toast from "react-hot-toast";

export default function UpdateQuestionId({ localSurvey, question, questionIdx, updateQuestion }) {
  const [currentValue, setCurrentValue] = useState(question.id);

  const saveAction = () => {
    // check if id is unique
    const questionIds = localSurvey.questions.map((q) => q.id);
    if (questionIds.includes(currentValue)) {
      alert("Question Identifier must be unique within the survey.");
      setCurrentValue(question.id);
      return;
    }
    updateQuestion(questionIdx, { id: currentValue });
    toast.success("Question ID updated.");
  };

  const isInputInvalid = currentValue.trim() === "" || currentValue.includes(" ");

  return (
    <div>
      <Label htmlFor="questionId">Question ID</Label>
      <div className="mt-2 inline-flex w-full">
        <Input
          id="questionId"
          name="questionId"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={saveAction}
          disabled={localSurvey.status !== "draft"}
          className={isInputInvalid ? "border-red-300 focus:border-red-300" : ""}
        />
      </div>
    </div>
  );
}
