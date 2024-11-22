"use client";

import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useGetBillingInfo } from "@/modules/utils/hooks/useGetBillingInfo";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon, XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type JSX, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { createI18nString } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TAllowedFileExtension, ZAllowedFileExtension } from "@formbricks/types/common";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyFileUploadQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface FileUploadFormProps {
  localSurvey: TSurvey;
  product?: TProduct;
  question: TSurveyFileUploadQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyFileUploadQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
  isFormbricksCloud: boolean;
  locale: TUserLocale;
}

export const FileUploadQuestionForm = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  product,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
  isFormbricksCloud,
  locale,
}: FileUploadFormProps): JSX.Element => {
  const [extension, setExtension] = useState("");
  const t = useTranslations();
  const [isMaxSizeError, setMaxSizeError] = useState(false);
  const {
    billingInfo,
    error: billingInfoError,
    isLoading: billingInfoLoading,
  } = useGetBillingInfo(product?.organizationId ?? "");
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

  const handleInputChange = (event) => {
    setExtension(event.target.value);
  };

  const addExtension = (event) => {
    event.preventDefault();
    event.stopPropagation();

    let modifiedExtension = extension.trim() as TAllowedFileExtension;

    // Remove the dot at the start if it exists
    if (modifiedExtension.startsWith(".")) {
      modifiedExtension = modifiedExtension.substring(1) as TAllowedFileExtension;
    }

    if (!modifiedExtension) {
      toast.error(t("environments.surveys.edit.please_enter_a_file_extension"));
      return;
    }

    const parsedExtensionResult = ZAllowedFileExtension.safeParse(modifiedExtension);

    if (!parsedExtensionResult.success) {
      toast.error(t("environments.surveys.edit.this_file_type_is_not_supported"));
      return;
    }

    if (question.allowedFileExtensions) {
      if (!question.allowedFileExtensions.includes(modifiedExtension as TAllowedFileExtension)) {
        updateQuestion(questionIdx, {
          allowedFileExtensions: [...question.allowedFileExtensions, modifiedExtension],
        });
        setExtension("");
      } else {
        toast.error(t("environments.surveys.edit.this_extension_is_already_added"));
      }
    } else {
      updateQuestion(questionIdx, { allowedFileExtensions: [modifiedExtension] });
      setExtension("");
    }
  };

  const removeExtension = (event, index: number) => {
    event.preventDefault();
    if (question.allowedFileExtensions) {
      const updatedExtensions = [...question?.allowedFileExtensions];
      updatedExtensions.splice(index, 1);
      updateQuestion(questionIdx, { allowedFileExtensions: updatedExtensions });
    }
  };

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

    updateQuestion(questionIdx, { maxSizeInMB: checked ? defaultMaxSizeInMB : undefined });
  };

  const [parent] = useAutoAnimate();

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
        locale={locale}
      />
      <div ref={parent}>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            className="mt-3"
            variant="minimal"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>
      <div className="mb-8 mt-6 space-y-6">
        <AdvancedOptionToggle
          isChecked={question.allowMultipleFiles}
          onToggle={() => updateQuestion(questionIdx, { allowMultipleFiles: !question.allowMultipleFiles })}
          htmlId="allowMultipleFile"
          title={t("environments.surveys.edit.allow_multiple_files")}
          description={t("environments.surveys.edit.let_people_upload_up_to_25_files_at_the_same_time")}
          childBorder
          customContainerClass="p-0"></AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={!!question.maxSizeInMB}
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
                value={question.maxSizeInMB}
                onChange={(e) => {
                  const parsedValue = parseInt(e.target.value, 10);

                  if (isFormbricksCloud && parsedValue > maxSizeInMBLimit) {
                    toast.error(
                      `${t("environments.surveys.edit.max_file_size_limit_is")} ${maxSizeInMBLimit} MB`
                    );
                    setMaxSizeError(true);
                    updateQuestion(questionIdx, { maxSizeInMB: maxSizeInMBLimit });
                    return;
                  }

                  updateQuestion(questionIdx, { maxSizeInMB: parseInt(e.target.value, 10) });
                }}
                className="ml-2 mr-2 inline w-20 bg-white text-center text-sm"
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
                  {t("environments.surveys.edit.upgrade_your_plan")}
                </Link>
              </p>
            )}
          </label>
        </AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={!!question.allowedFileExtensions}
          onToggle={(checked) =>
            updateQuestion(questionIdx, { allowedFileExtensions: checked ? [] : undefined })
          }
          htmlId="limitFileType"
          title={t("environments.surveys.edit.limit_file_types")}
          description={t("environments.surveys.edit.control_which_file_types_can_be_uploaded")}
          childBorder
          customContainerClass="p-0">
          <div className="p-4">
            <div className="flex flex-row flex-wrap gap-2">
              {question.allowedFileExtensions &&
                question.allowedFileExtensions.map((item, index) => (
                  <div className="mb-2 flex h-8 items-center space-x-2 rounded-full bg-slate-200 px-2">
                    <p className="text-sm text-slate-800">{item}</p>
                    <Button
                      className="inline-flex px-0"
                      variant="minimal"
                      onClick={(e) => removeExtension(e, index)}>
                      <XCircleIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
            <div className="flex items-center">
              <Input
                autoFocus
                className="mr-2 w-20 rounded-md bg-white placeholder:text-sm"
                placeholder=".pdf"
                value={extension}
                onChange={handleInputChange}
                type="text"
              />
              <Button size="sm" variant="secondary" onClick={(e) => addExtension(e)}>
                {t("environments.surveys.edit.allow_file_type")}
              </Button>
            </div>
          </div>
        </AdvancedOptionToggle>
      </div>
    </form>
  );
};
