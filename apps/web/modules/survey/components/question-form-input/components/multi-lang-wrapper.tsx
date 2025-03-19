"use client";

import { LanguageIndicator } from "@/modules/ee/multi-language-surveys/components/language-indicator";
import { useTranslate } from "@tolgee/react";
import { ReactNode, useMemo } from "react";
import { getEnabledLanguages } from "@formbricks/lib/i18n/utils";
import { headlineToRecall, recallToHeadline } from "@formbricks/lib/utils/recall";
import { TI18nString, TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

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
  selectedLanguageCode: string;
  setSelectedLanguageCode: (code: string) => void;
  locale: TUserLocale;
  render: (props: MultiLangWrapperRenderProps) => ReactNode;
}

export const MultiLangWrapper = ({
  isTranslationIncomplete,
  value,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  render,
  onChange,
}: MultiLangWrapperProps) => {
  const { t } = useTranslate();

  const defaultLanguageCode =
    localSurvey.languages.filter((lang) => lang.default)[0]?.language.code ?? "default";
  const usedLanguageCode = selectedLanguageCode === defaultLanguageCode ? "default" : selectedLanguageCode;

  const enabledLanguages = useMemo(
    () => getEnabledLanguages(localSurvey.languages ?? []),
    [localSurvey.languages]
  );

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
          children:
            enabledLanguages.length > 1 ? (
              <LanguageIndicator
                selectedLanguageCode={usedLanguageCode}
                surveyLanguages={localSurvey.languages}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
              />
            ) : null,
        })}
      </div>

      {enabledLanguages.length > 1 && (
        <>
          {usedLanguageCode !== "default" && value && typeof value["default"] !== "undefined" && (
            <div className="mt-1 text-xs text-slate-500">
              <strong>{t("environments.project.languages.translate")}:</strong>{" "}
              {recallToHeadline(value, localSurvey, false, "default")["default"]}
            </div>
          )}

          {usedLanguageCode === "default" && localSurvey.languages?.length > 1 && isTranslationIncomplete && (
            <div className="mt-1 text-xs text-red-400">
              {t("environments.project.languages.incomplete_translations")}
            </div>
          )}
        </>
      )}
    </div>
  );
};
