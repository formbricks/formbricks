"use client";

import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyConsentElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";

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

  return (
    <form>
      <ElementFormInput
        {...commonInputProps}
        id="headline"
        value={element.headline}
        label={t("environments.surveys.edit.question") + "*"}
        autoFocus={!element.headline?.default || element.headline.default.trim() === ""}
      />

      <div className="mt-3">
        <ElementFormInput
          {...commonInputProps}
          id="subheader"
          value={element.subheader}
          label={t("common.description")}
        />
      </div>

      <ElementFormInput
        {...commonInputProps}
        id="label"
        label={t("environments.surveys.edit.checkbox_label") + "*"}
        placeholder="I agree to the terms and conditions"
        value={element.label}
      />
    </form>
  );
};
