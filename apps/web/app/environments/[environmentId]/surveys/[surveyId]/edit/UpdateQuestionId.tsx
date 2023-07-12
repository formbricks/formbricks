"use client";

import { Input, Label } from "@formbricks/ui";
import { useState } from "react";
import toast from "react-hot-toast";

export default function UpdateQuestionId({ localSurvey, question, questionIdx, updateQuestion }) {
  const [currentValue, setCurrentValue] = useState(question.id);
  const [prevValue, setPrevValue] = useState(question.id);

  const saveAction = () => {
    // return early if the input value was not changed
    if (currentValue === prevValue) {
      return;
    }

    // check if id is unique
    const questionIds = localSurvey.questions.map((q) => q.id);
    if (questionIds.includes(currentValue)) {
      toast.error("IDs have to be unique per survey.");
      setCurrentValue(question.id);
      return;
    }

    // check if id contains any spaces
    if (currentValue.trim() === "" || currentValue.includes(" ")) {
      toast.error("ID should not contain space.");
      setCurrentValue(question.id);
      return;
    }

    updateQuestion(questionIdx, { id: currentValue });
    toast.success("Question ID updated.");
    setPrevValue(currentValue); // after successful update, set current value as previous value
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
          disabled={!(localSurvey.status === "draft" || question.isDraft)}
          className={isInputInvalid ? "border-red-300 focus:border-red-300" : ""}
        />
      </div>
    </div>
  );
}
