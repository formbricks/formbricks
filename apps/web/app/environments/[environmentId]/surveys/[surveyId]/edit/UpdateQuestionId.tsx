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

  return (
    <div>
      <Label htmlFor="questionId">Question ID</Label>
      <div className="mt-2 inline-flex w-full">
        <Input
          id="questionId"
          name="questionId"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          disabled={localSurvey.status !== "draft"}
        />
        {localSurvey.status === "draft" && (
          <Button
            variant="darkCTA"
            className="ml-2 bg-slate-600 text-white hover:bg-slate-700 disabled:bg-slate-400"
            onClick={saveAction}
            disabled={currentValue === question.id}>
            <CheckIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
