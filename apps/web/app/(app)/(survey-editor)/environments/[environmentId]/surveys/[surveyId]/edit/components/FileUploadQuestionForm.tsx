"use client";

import { PlusIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { createI18nString } from "@formbricks/lib/i18n/utils";
import { useGetBillingInfo } from "@formbricks/lib/organization/hooks/useGetBillingInfo";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TAllowedFileExtension, ZAllowedFileExtension } from "@formbricks/types/common";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyFileUploadQuestion } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

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
}: FileUploadFormProps): JSX.Element => {
  const [extension, setExtension] = useState("");
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
      toast.error("Please enter a file extension.");
      return;
    }

    const parsedExtensionResult = ZAllowedFileExtension.safeParse(modifiedExtension);

    if (!parsedExtensionResult.success) {
      toast.error("This file type is not supported.");
      return;
    }

    if (question.allowedFileExtensions) {
      if (!question.allowedFileExtensions.includes(modifiedExtension as TAllowedFileExtension)) {
        updateQuestion(questionIdx, {
          allowedFileExtensions: [...question.allowedFileExtensions, modifiedExtension],
        });
        setExtension("");
      } else {
        toast.error("This extension is already added.");
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

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={"Question*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />
      <div>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
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
            Add Description
          </Button>
        )}
      </div>
      <div className="mb-8 mt-6 space-y-6">
        <AdvancedOptionToggle
          isChecked={question.allowMultipleFiles}
          onToggle={() => updateQuestion(questionIdx, { allowMultipleFiles: !question.allowMultipleFiles })}
          htmlId="allowMultipleFile"
          title="Allow Multiple Files"
          description="Let people upload up to 25 files at the same time."
          childBorder
          customContainerClass="p-0"></AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={!!question.maxSizeInMB}
          onToggle={handleMaxSizeInMBToggle}
          htmlId="maxFileSize"
          title="Max file size"
          description="Limit the maximum file size."
          childBorder
          customContainerClass="p-0">
          <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Limit upload file size to
              <Input
                autoFocus
                type="number"
                id="fileSizeLimit"
                value={question.maxSizeInMB}
                onChange={(e) => {
                  const parsedValue = parseInt(e.target.value, 10);

                  if (isFormbricksCloud && parsedValue > maxSizeInMBLimit) {
                    toast.error(`Max file size limit is ${maxSizeInMBLimit} MB`);
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
                Max file size limit is {maxSizeInMBLimit} MB. If you need more, please{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href={`/environments/${localSurvey.environmentId}/settings/billing`}>
                  upgrade your plan.
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
          title="Limit file types"
          description="Control which file types can be uploaded."
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
                Allow file type
              </Button>
            </div>
          </div>
        </AdvancedOptionToggle>
      </div>
    </form>
  );
};
