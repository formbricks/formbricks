"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { validateId } from "@formbricks/types/surveys/validation";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface UpdateElementIdProps {
  localSurvey: TSurvey;
  element: TSurveyElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: any) => void;
}

export const UpdateElementId = ({
  localSurvey,
  element,
  elementIdx,
  updateElement,
}: UpdateElementIdProps) => {
  const { t } = useTranslation();
  const [currentValue, setCurrentValue] = useState(element.id);
  const [prevValue, setPrevValue] = useState(element.id);
  const [isInputInvalid, setIsInputInvalid] = useState(
    currentValue.trim() === "" || currentValue.includes(" ")
  );

  const saveAction = () => {
    // return early if the input value was not changed
    if (currentValue === prevValue) {
      return;
    }

    const elements = getElementsFromBlocks(localSurvey.blocks);
    const elementIds = elements.map((q) => q.id);
    const endingCardIds = localSurvey.endings.map((e) => e.id);
    const hiddenFieldIds = localSurvey.hiddenFields.fieldIds ?? [];

    const validateIdError = validateId("Question", currentValue, elementIds, endingCardIds, hiddenFieldIds);

    if (validateIdError) {
      setIsInputInvalid(true);
      toast.error(validateIdError);
      setCurrentValue(prevValue);
      return;
    }

    setIsInputInvalid(false);
    toast.success(t("environments.surveys.edit.question_id_updated"));
    updateElement(elementIdx, { id: currentValue });
    setPrevValue(currentValue); // after successful update, set current value as previous value
  };

  const isButtonDisabled = () => {
    if (currentValue === element.id || currentValue.trim() === "") return true;
    else return false;
  };

  return (
    <div>
      <Label htmlFor="elementId">{t("common.question_id")}</Label>
      <div className="mt-2 inline-flex w-full items-center space-x-2">
        <Input
          id="elementId"
          name="elementId"
          value={currentValue}
          onChange={(e) => {
            setCurrentValue(e.target.value);
          }}
          dir="auto"
          disabled={localSurvey.status !== "draft" && !element.isDraft}
          className={`h-10 ${isInputInvalid ? "border-red-300 focus:border-red-300" : ""}`}
        />
        <Button size="sm" onClick={saveAction} disabled={isButtonDisabled()} className="h-10">
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
};
