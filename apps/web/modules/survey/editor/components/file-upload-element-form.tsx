"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { type JSX, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyFileUploadElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { ValidationRulesEditor } from "@/modules/survey/editor/components/validation-rules-editor";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useGetBillingInfo } from "@/modules/utils/hooks/useGetBillingInfo";

interface FileUploadFormProps {
  localSurvey: TSurvey;
  project: Project;
  element: TSurveyFileUploadElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Partial<TSurveyFileUploadElement>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  isFormbricksCloud: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const FileUploadElementForm = ({
  localSurvey,
  element,
  elementIdx,
  updateElement,
  isInvalid,
  project,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isFormbricksCloud,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: FileUploadFormProps): JSX.Element => {
  const { t } = useTranslation();
  const [isMaxSizeError, setIsMaxSizeError] = useState(false);
  const {
    billingInfo,
    error: billingInfoError,
    isLoading: billingInfoLoading,
  } = useGetBillingInfo(project.organizationId);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

  const maxSizeInMBLimit = useMemo(() => {
    if (billingInfoError || billingInfoLoading || !billingInfo) {
      return 10;
    }

    if (billingInfo.plan !== "free") {
      // 1GB in MB
      return 1024;
    }

    return 10;
  }, [billingInfo, billingInfoError, billingInfoLoading]);

  const handleMaxSizeInMBToggle = (checked: boolean) => {
    const defaultMaxSizeInMB = isFormbricksCloud ? maxSizeInMBLimit : 1024;

    updateElement(elementIdx, { maxSizeInMB: checked ? defaultMaxSizeInMB : undefined });
  };

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
      </div>
      <div className="mt-6 space-y-6">
        <AdvancedOptionToggle
          isChecked={element.allowMultipleFiles}
          onToggle={() => updateElement(elementIdx, { allowMultipleFiles: !element.allowMultipleFiles })}
          htmlId="allowMultipleFile"
          title={t("environments.surveys.edit.allow_multiple_files")}
          description={t("environments.surveys.edit.let_people_upload_up_to_25_files_at_the_same_time")}
          childBorder
          customContainerClass="p-0"></AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={!!element.maxSizeInMB}
          onToggle={handleMaxSizeInMBToggle}
          htmlId="maxFileSize"
          title={t("environments.surveys.edit.max_file_size")}
          description={t("environments.surveys.edit.limit_the_maximum_file_size")}
          childBorder
          customContainerClass="p-0">
          <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              {t("environments.surveys.edit.limit_upload_file_size_to")}
              <Input
                autoFocus
                type="number"
                id="fileSizeLimit"
                value={element.maxSizeInMB}
                onChange={(e) => {
                  const parsedValue = Number.parseInt(e.target.value, 10);

                  if (isFormbricksCloud && parsedValue > maxSizeInMBLimit) {
                    toast.error(
                      `${t("environments.surveys.edit.max_file_size_limit_is")} ${maxSizeInMBLimit} MB`
                    );
                    setIsMaxSizeError(true);
                    updateElement(elementIdx, { maxSizeInMB: maxSizeInMBLimit });
                    return;
                  }

                  updateElement(elementIdx, { maxSizeInMB: Number.parseInt(e.target.value, 10) });
                }}
                className="mr-2 ml-2 inline w-20 bg-white text-center text-sm"
              />
              MB
            </p>
            {isMaxSizeError && (
              <p className="text-xs text-red-500">
                {t("environments.surveys.edit.max_file_size_limit_is")} {maxSizeInMBLimit} MB.{" "}
                {t("environments.surveys.edit.if_you_need_more_please")}
                <Link
                  className="underline"
                  target="_blank"
                  href={`/environments/${localSurvey.environmentId}/settings/billing`}>
                  {t("common.please_upgrade_your_plan")}
                </Link>
              </p>
            )}
          </label>
        </AdvancedOptionToggle>
      </div>

      <ValidationRulesEditor
        elementType={element.type}
        validation={element.validation}
        onUpdateValidation={(validation) => {
          updateElement(elementIdx, {
            validation,
          });
        }}
        element={element}
      />
    </form>
  );
};
