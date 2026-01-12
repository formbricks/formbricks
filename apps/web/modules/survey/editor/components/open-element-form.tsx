"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  TSurveyElementTypeEnum,
  TSurveyOpenTextElement,
  TSurveyOpenTextElementInputType,
} from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { ValidationRulesEditor } from "@/modules/survey/editor/components/validation-rules-editor";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";

interface OpenElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyOpenTextElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyOpenTextElement>) => void;
  lastElement: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const OpenElementForm = ({
  element,
  elementIdx,
  updateElement,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: OpenElementFormProps): JSX.Element => {
  const { t } = useTranslation();
  const defaultPlaceholder = getPlaceholderByInputType(element.inputType ?? "text");
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const [parent] = useAutoAnimate();

  return (
    <form>
      <ElementFormInput
        id="headline"
        value={element.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        elementIdx={elementIdx}
        isInvalid={isInvalid}
        updateElement={updateElement}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        isStorageConfigured={isStorageConfigured}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
      />

      <div ref={parent}>
        {element.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <ElementFormInput
                id="subheader"
                value={element.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                elementIdx={elementIdx}
                isInvalid={isInvalid}
                updateElement={updateElement}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                autoFocus={!element.subheader?.default || element.subheader.default.trim() === ""}
                isExternalUrlsAllowed={isExternalUrlsAllowed}
              />
            </div>
          </div>
        )}
        {element.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => {
              updateElement(elementIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>
      <div className="mt-2">
        <ElementFormInput
          id="placeholder"
          value={
            element.placeholder
              ? element.placeholder
              : createI18nString(defaultPlaceholder, surveyLanguageCodes)
          }
          localSurvey={localSurvey}
          elementIdx={elementIdx}
          isInvalid={isInvalid}
          updateElement={updateElement}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          label={t("common.placeholder")}
          locale={locale}
          isStorageConfigured={isStorageConfigured}
        />
      </div>

      <div className="mt-6 space-y-6">
        <div className="mt-4">
          <AdvancedOptionToggle
            isChecked={element.longAnswer !== false}
            onToggle={(checked: boolean) => {
              updateElement(elementIdx, {
                longAnswer: checked,
              });
            }}
            htmlId={`longAnswer-${element.id}`}
            title={t("environments.surveys.edit.long_answer")}
            description={t("environments.surveys.edit.long_answer_toggle_description")}
            disabled={element.inputType !== "text"}
            customContainerClass="p-0"
          />
        </div>

        <ValidationRulesEditor
          elementType={TSurveyElementTypeEnum.OpenText}
          validation={element.validation}
          onUpdateValidation={(validation) => {
            updateElement(elementIdx, {
              validation,
            });
          }}
          inputType={element.inputType ?? "text"}
          onUpdateInputType={(newInputType) => {
            updateElement(elementIdx, {
              inputType: newInputType,
              // Update placeholder if not already set
              placeholder:
                element.placeholder ||
                createI18nString(getPlaceholderByInputType(newInputType), surveyLanguageCodes),
              longAnswer: newInputType === "text",
            });
          }}
        />
      </div>
    </form>
  );
};

const getPlaceholderByInputType = (inputType: TSurveyOpenTextElementInputType) => {
  switch (inputType) {
    case "email":
      return "example@email.com";
    case "url":
      return "https://...";
    case "number":
      return "42";
    case "phone":
      return "+1 123 456 789";
    default:
      return "Type your answer here...";
  }
};
