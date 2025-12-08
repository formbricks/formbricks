"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { HashIcon, LinkIcon, MailIcon, MessageSquareTextIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { JSX, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyOpenTextElement, TSurveyOpenTextElementInputType } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";

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
  const elementTypes = [
    { value: "text", label: t("common.text"), icon: <MessageSquareTextIcon className="h-4 w-4" /> },
    { value: "email", label: t("common.email"), icon: <MailIcon className="h-4 w-4" /> },
    { value: "url", label: t("common.url"), icon: <LinkIcon className="h-4 w-4" /> },
    { value: "number", label: t("common.number"), icon: <HashIcon className="h-4 w-4" /> },
    { value: "phone", label: t("common.phone"), icon: <PhoneIcon className="h-4 w-4" /> },
  ];
  const defaultPlaceholder = getPlaceholderByInputType(element.inputType ?? "text");
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const [showCharLimits, setShowCharLimits] = useState(element.inputType === "text");

  const handleInputChange = (inputType: TSurveyOpenTextElementInputType) => {
    const updatedAttributes = {
      inputType: inputType,
      placeholder: createI18nString(getPlaceholderByInputType(inputType), surveyLanguageCodes),
      longAnswer: inputType === "text" ? element.longAnswer : false,
      charLimit: {
        min: undefined,
        max: undefined,
      },
    };
    setIsCharLimitEnabled(false);
    setShowCharLimits(inputType === "text");
    updateElement(elementIdx, updatedAttributes);
  };

  const [parent] = useAutoAnimate();
  const [isCharLimitEnabled, setIsCharLimitEnabled] = useState(false);

  useEffect(() => {
    if (element?.charLimit?.min !== undefined || element?.charLimit?.max !== undefined) {
      setIsCharLimitEnabled(true);
    } else {
      setIsCharLimitEnabled(false);
    }
  }, [element?.charLimit?.max, element?.charLimit?.min]);

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

      {/* Add a dropdown to select the element type */}
      <div className="mt-3">
        <Label htmlFor="elementType">{t("common.input_type")}</Label>
        <div className="mt-2 flex items-center">
          <OptionsSwitch
            options={elementTypes}
            currentOption={element.inputType}
            handleOptionChange={handleInputChange} // Use the merged function
          />
        </div>
      </div>
      <div className="mt-6 space-y-6">
        {showCharLimits && (
          <AdvancedOptionToggle
            isChecked={isCharLimitEnabled}
            onToggle={(checked: boolean) => {
              setIsCharLimitEnabled(checked);
              updateElement(elementIdx, {
                charLimit: {
                  enabled: checked,
                  min: undefined,
                  max: undefined,
                },
              });
            }}
            htmlId={`charLimit-${element.id}`}
            description={t("environments.surveys.edit.character_limit_toggle_description")}
            childBorder
            title={t("environments.surveys.edit.character_limit_toggle_title")}
            customContainerClass="p-0">
            <div className="flex gap-4 p-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="minLength">{t("common.minimum")}</Label>
                <Input
                  id="minLength"
                  name="minLength"
                  type="number"
                  min={0}
                  value={element?.charLimit?.min || ""}
                  aria-label={t("common.minimum")}
                  className="bg-white"
                  onChange={(e) =>
                    updateElement(elementIdx, {
                      charLimit: {
                        ...element?.charLimit,
                        min: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="maxLength">{t("common.maximum")}</Label>
                <Input
                  id="maxLength"
                  name="maxLength"
                  type="number"
                  min={0}
                  aria-label={t("common.maximum")}
                  value={element?.charLimit?.max || ""}
                  className="bg-white"
                  onChange={(e) =>
                    updateElement(elementIdx, {
                      charLimit: {
                        ...element?.charLimit,
                        max: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          </AdvancedOptionToggle>
        )}
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
