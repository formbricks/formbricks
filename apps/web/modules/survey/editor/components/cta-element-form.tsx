"use client";

import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyCTAElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface CTAElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyCTAElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyCTAElement>) => void;
  lastElement: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const CTAElementForm = ({
  element,
  elementIdx,
  updateElement,
  lastElement,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: CTAElementFormProps): JSX.Element => {
  const { t } = useTranslation();

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

      <div className="mt-3">
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
          isExternalUrlsAllowed={isExternalUrlsAllowed}
        />
      </div>

      <div className="mt-3 flex-1">
        <AdvancedOptionToggle
          isChecked={element.buttonExternal}
          onToggle={() => updateElement(elementIdx, { buttonExternal: !element.buttonExternal })}
          htmlId="buttonExternal"
          title={t("environments.surveys.edit.button_external")}
          description={t("environments.surveys.edit.button_external_description")}
          childBorder
          customContainerClass="p-0 mt-4">
          <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-1">
            <ElementFormInput
              id="ctaButtonLabel"
              value={element.ctaButtonLabel}
              label={t("environments.surveys.edit.cta_button_label")}
              localSurvey={localSurvey}
              elementIdx={elementIdx}
              maxLength={48}
              placeholder={lastElement ? t("common.finish") : t("common.next")}
              isInvalid={isInvalid}
              updateElement={updateElement}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              locale={locale}
              isStorageConfigured={isStorageConfigured}
            />

            <div>
              <Label htmlFor="buttonLabel">{t("environments.surveys.edit.button_url")}</Label>
              <Input
                id="buttonUrl"
                name="buttonUrl"
                value={element.buttonUrl}
                placeholder="https://website.com"
                onChange={(e) => updateElement(elementIdx, { buttonUrl: e.target.value })}
              />
            </div>
          </div>
        </AdvancedOptionToggle>
      </div>
    </form>
  );
};
