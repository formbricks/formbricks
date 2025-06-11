"use client";

import { headlineToRecall, recallToHeadline } from "@/lib/utils/recall";
import { RecallWrapper } from "@/modules/survey/components/question-form-input/components/recall-wrapper";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useTranslate } from "@tolgee/react";
import { useRef } from "react";
import { TSurvey, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";

interface RedirectUrlFormProps {
  localSurvey: TSurvey;
  endingCard: TSurveyRedirectUrlCard;
  updateSurvey: (input: Partial<TSurveyRedirectUrlCard>) => void;
}

export const RedirectUrlForm = ({ localSurvey, endingCard, updateSurvey }: RedirectUrlFormProps) => {
  const selectedLanguageCode = "default";
  const { t } = useTranslate();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label>{t("common.url")}</Label>
        <RecallWrapper
          value={endingCard.url ?? ""}
          questionId={endingCard.id}
          onChange={(val, recallItems, fallbacks) => {
            const updatedValue = {
              ...endingCard,
              url: recallItems && fallbacks ? headlineToRecall(val, recallItems, fallbacks) : val,
            };

            updateSurvey(updatedValue);
          }}
          onAddFallback={() => {
            inputRef.current?.focus();
          }}
          isRecallAllowed
          shouldDisplaySurveyQuestions={true}
          localSurvey={localSurvey}
          usedLanguageCode={"default"}
          render={({ value, onChange, highlightedJSX, children }) => {
            return (
              <div className="group relative">
                {/* The highlight container is absolutely positioned behind the input */}
                <div
                  className={`no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent`}
                  dir="auto"
                  key={highlightedJSX.toString()}>
                  {highlightedJSX}
                </div>
                <Input
                  ref={inputRef}
                  id="redirectUrl"
                  name="redirectUrl"
                  className="relative text-black caret-black"
                  placeholder="https://formbricks.com"
                  value={
                    recallToHeadline(
                      {
                        [selectedLanguageCode]: value,
                      },
                      localSurvey,
                      false,
                      "default"
                    )[selectedLanguageCode]
                  }
                  onChange={(e) => onChange(e.target.value)}
                />
                {children}
              </div>
            );
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.label")}</Label>
        <Input
          id="redirectUrlLabel"
          name="redirectUrlLabel"
          className="bg-white"
          placeholder="Formbricks App"
          value={endingCard.label}
          onChange={(e) => updateSurvey({ label: e.target.value })}
        />
      </div>
    </form>
  );
};
