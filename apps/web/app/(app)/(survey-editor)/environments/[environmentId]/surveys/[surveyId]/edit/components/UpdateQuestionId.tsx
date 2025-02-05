"use client";

import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { validateId } from "@formbricks/types/surveys/validation";

interface UpdateQuestionIdProps {
  localSurvey: TSurvey;
  question: TSurveyQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
}

export const UpdateQuestionId = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
}: UpdateQuestionIdProps) => {
  const { t } = useTranslate();
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
    const endingCardIds = localSurvey.endings.map((e) => e.id);
    const hiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];

    const validateIdError = validateId("Question", currentValue, questionIds, endingCardIds, hiddenFieldIds);

    if (validateIdError) {
      setIsInputInvalid(true);
      toast.error(validateIdError);
      setCurrentValue(prevValue);
      return;
    }

    setIsInputInvalid(false);
    toast.success(t("environments.surveys.edit.question_id_updated"));
    updateQuestion(questionIdx, { id: currentValue });
    setPrevValue(currentValue); // after successful update, set current value as previous value
  };

  const isButtonDisabled = () => {
    if (currentValue === question.id || currentValue.trim() === "") return true;
    else return false;
  };

  return (
    <div>
      <Label htmlFor="questionId">{t("common.question_id")}</Label>
      <div className="mt-2 inline-flex w-full items-center space-x-2">
        <Input
          id="questionId"
          name="questionId"
          value={currentValue}
          onChange={(e) => {
            setCurrentValue(e.target.value);
          }}
          dir="auto"
          disabled={localSurvey.status !== "draft" && !question.isDraft}
          className={`h-10 ${isInputInvalid ? "border-red-300 focus:border-red-300" : ""}`}
        />
        <Button size="sm" onClick={saveAction} disabled={isButtonDisabled()}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
};
