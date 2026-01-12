"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyConsentElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TValidationRulesForConsent } from "@formbricks/types/surveys/validation-rules";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { ValidationRulesEditor } from "@/modules/survey/editor/components/validation-rules-editor";
import { Button } from "@/modules/ui/components/button";

interface ConsentElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyConsentElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyConsentElement>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const ConsentElementForm = ({
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
}: ConsentElementFormProps): JSX.Element => {
  const { t } = useTranslation();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

  // Common props shared across all ElementFormInput components
  const commonInputProps = {
    localSurvey,
    elementIdx,
    isInvalid,
    updateElement,
    selectedLanguageCode,
    setSelectedLanguageCode,
    locale,
    isStorageConfigured,
    isExternalUrlsAllowed,
  };

  const [parent] = useAutoAnimate();

  return (
    <form>
      <ElementFormInput
        {...commonInputProps}
        id="headline"
        value={element.headline}
        label={t("environments.surveys.edit.question") + "*"}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
      />

      <div ref={parent}>
        {element.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <ElementFormInput
                {...commonInputProps}
                id="subheader"
                value={element.subheader}
                label={t("common.description")}
                autoFocus={!element.subheader?.default || element.subheader.default.trim() === ""}
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

      <ElementFormInput
        {...commonInputProps}
        id="label"
        label={t("environments.surveys.edit.checkbox_label") + "*"}
        placeholder="I agree to the terms and conditions"
        value={element.label}
      />

      <ValidationRulesEditor
        elementType={TSurveyElementTypeEnum.Consent}
        validation={element.validation}
          onUpdateValidation={(validation) => {
            updateElement(elementIdx, {
              validation,
            });
          }}
      />
    </form>
  );
};
