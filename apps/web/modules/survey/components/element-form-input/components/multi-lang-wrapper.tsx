"use client";

import { ReactNode } from "react";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { headlineToRecall } from "@/lib/utils/recall";

interface MultiLangWrapperRenderProps {
  value: TI18nString;
  onChange: (value: string, recallItems?: TSurveyRecallItem[], fallbacks?: { [key: string]: string }) => void;
  children?: ReactNode;
}

interface MultiLangWrapperProps {
  isTranslationIncomplete: boolean;
  value: TI18nString;
  onChange: (value: TI18nString) => void;
  localSurvey: TSurvey;
  selectedLanguageCode?: string;
  setSelectedLanguageCode?: (code: string) => void;
  locale?: string;
  render: (props: MultiLangWrapperRenderProps) => ReactNode;
}

export const MultiLangWrapper = ({
  value,
  localSurvey,
  selectedLanguageCode = "default",
  render,
  onChange,
}: MultiLangWrapperProps) => {
  const defaultLanguageCode =
    localSurvey.languages.filter((lang) => lang.default)[0]?.language.code ?? "default";
  const usedLanguageCode = selectedLanguageCode === defaultLanguageCode ? "default" : selectedLanguageCode;

  const handleChange = (
    newValue: string,
    recallItems?: TSurveyRecallItem[],
    fallbacks?: { [key: string]: string }
  ) => {
    const updatedValue = {
      ...value,
      [usedLanguageCode]:
        recallItems && fallbacks ? headlineToRecall(newValue, recallItems, fallbacks) : newValue,
    };
    onChange(updatedValue);
  };

  return (
    <div className="w-full">
      <div>
        {render({
          value,
          onChange: handleChange,
          children: null,
        })}
      </div>
    </div>
  );
};
