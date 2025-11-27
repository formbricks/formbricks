"use client";

import { PlusIcon } from "lucide-react";
import { type JSX, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface CalElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyCalElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyCalElement>) => void;
  lastElement: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const CalElementForm = ({
  localSurvey,
  element,
  elementIdx,
  updateElement,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: CalElementFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const [isCalHostEnabled, setIsCalHostEnabled] = useState(!!element.calHost);
  const { t } = useTranslation();
  useEffect(() => {
    if (!isCalHostEnabled) {
      updateElement(elementIdx, { calHost: undefined });
    } else {
      updateElement(elementIdx, { calHost: element.calHost ?? "cal.com" });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalHostEnabled]);

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
      <div>
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
            className="mt-3"
            variant="secondary"
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
        <div className="mt-5 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="calUserName">{t("environments.surveys.edit.cal_username")}</Label>
            <div>
              <Input
                id="calUserName"
                name="calUserName"
                value={element.calUserName}
                onChange={(e) => updateElement(elementIdx, { calUserName: e.target.value })}
              />
            </div>
          </div>

          <AdvancedOptionToggle
            isChecked={isCalHostEnabled}
            onToggle={(checked: boolean) => setIsCalHostEnabled(checked)}
            htmlId="calHost"
            description={t("environments.surveys.edit.needed_for_self_hosted_cal_com_instance")}
            childBorder
            title={t("environments.surveys.edit.custom_hostname")}
            customContainerClass="p-0">
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="calHost">{t("environments.surveys.edit.hostname")}</Label>
                <Input
                  id="calHost"
                  name="calHost"
                  placeholder="my-cal-instance.com"
                  value={element.calHost}
                  className="bg-white"
                  onChange={(e) => updateElement(elementIdx, { calHost: e.target.value })}
                />
              </div>
            </div>
          </AdvancedOptionToggle>
        </div>
      </div>
    </form>
  );
};
