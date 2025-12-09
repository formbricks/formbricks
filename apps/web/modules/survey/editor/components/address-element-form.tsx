"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { type JSX, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyAddressElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Button } from "@/modules/ui/components/button";
import { ElementToggleTable } from "@/modules/ui/components/element-toggle-table";

interface AddressElementFormProps {
  localSurvey: TSurvey;
  element: TSurveyAddressElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyAddressElement>) => void;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const AddressElementForm = ({
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
}: AddressElementFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);
  const { t } = useTranslation();
  const fields = [
    {
      id: "addressLine1",
      label: t("environments.surveys.edit.address_line_1"),
      ...element.addressLine1,
    },
    {
      id: "addressLine2",
      label: t("environments.surveys.edit.address_line_2"),
      ...element.addressLine2,
    },
    {
      id: "city",
      label: t("environments.surveys.edit.city"),
      ...element.city,
    },
    {
      id: "state",
      label: t("environments.surveys.edit.state"),
      ...element.state,
    },
    {
      id: "zip",
      label: t("environments.surveys.edit.zip"),
      ...element.zip,
    },
    {
      id: "country",
      label: t("environments.surveys.edit.country"),
      ...element.country,
    },
  ];

  useEffect(() => {
    const allFieldsAreOptional = [
      element.addressLine1,
      element.addressLine2,
      element.city,
      element.state,
      element.zip,
      element.country,
    ]
      .filter((field) => field.show)
      .every((field) => !field.required);

    updateElement(elementIdx, { required: !allFieldsAreOptional });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.addressLine1, element.addressLine2, element.city, element.state, element.zip, element.country]);

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
            className="mt-4"
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

        <ElementToggleTable
          type="address"
          fields={fields}
          localSurvey={localSurvey}
          elementIdx={elementIdx}
          isInvalid={isInvalid}
          updateElement={updateElement}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          locale={locale}
          isStorageConfigured={isStorageConfigured}
        />
      </div>
    </form>
  );
};
