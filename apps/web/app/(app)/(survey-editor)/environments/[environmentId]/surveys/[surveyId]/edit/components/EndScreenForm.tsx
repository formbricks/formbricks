"use client";

import { useState } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyEndScreenCard } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";

interface EndScreenFormProps {
  localSurvey: TSurvey;
  endingCardIndex: number;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  attributeClasses: TAttributeClass[];
  updateSurvey: (input: Partial<TSurveyEndScreenCard>) => void;
  endingCard: TSurveyEndScreenCard;
}

export const EndScreenForm = ({
  localSurvey,
  endingCardIndex,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
  updateSurvey,
  endingCard,
}: EndScreenFormProps) => {
  const [showEndingCardCTA, setshowEndingCardCTA] = useState<boolean>(
    endingCard.type === "endScreen" &&
      (!!getLocalizedValue(endingCard.buttonLabel, selectedLanguageCode) || !!endingCard.buttonLink)
  );
  return (
    <form>
      <QuestionFormInput
        id="headline"
        label="Note*"
        value={endingCard.headline}
        localSurvey={localSurvey}
        questionIdx={localSurvey.questions.length + endingCardIndex}
        isInvalid={isInvalid}
        updateSurvey={updateSurvey}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />

      <QuestionFormInput
        id="subheader"
        value={endingCard.subheader}
        label={"Description"}
        localSurvey={localSurvey}
        questionIdx={localSurvey.questions.length + endingCardIndex}
        isInvalid={isInvalid}
        updateSurvey={updateSurvey}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />
      <div className="mt-4">
        <div className="flex items-center space-x-1">
          <Switch
            id="showButton"
            checked={showEndingCardCTA}
            onCheckedChange={() => {
              if (showEndingCardCTA) {
                updateSurvey({ buttonLabel: undefined, buttonLink: undefined });
              } else {
                updateSurvey({
                  buttonLabel: { default: "Create your own Survey" },
                  buttonLink: "https://formbricks.com/signup",
                });
              }
              setshowEndingCardCTA(!showEndingCardCTA);
            }}
          />
          <Label htmlFor="showButton" className="cursor-pointer">
            <div className="ml-2">
              <h3 className="text-sm font-semibold text-slate-700">Show Button</h3>
              <p className="text-xs font-normal text-slate-500">
                Send your respondents to a page of your choice.
              </p>
            </div>
          </Label>
        </div>
        {showEndingCardCTA && (
          <div className="border-1 mt-4 space-y-4 rounded-md border bg-slate-100 p-4 pt-2">
            <div className="space-y-2">
              <QuestionFormInput
                id="buttonLabel"
                label="Button Label"
                placeholder="Create your own Survey"
                className="bg-white"
                value={endingCard.buttonLabel}
                localSurvey={localSurvey}
                questionIdx={localSurvey.questions.length + endingCardIndex}
                isInvalid={isInvalid}
                updateSurvey={updateSurvey}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />
            </div>
            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input
                id="buttonLink"
                name="buttonLink"
                className="bg-white"
                placeholder="https://formbricks.com/signup"
                value={endingCard.buttonLink}
                onChange={(e) => updateSurvey({ buttonLink: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
