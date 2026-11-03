"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import type {
  TSurveyCesElement,
  TSurveyCsatElement,
  TSurveyElement,
  TSurveyFileUploadElement,
  TSurveyNPSElement,
  TSurveyOpenTextElement,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Input } from "@/modules/ui/components/input";
import { useGetBillingInfo } from "@/modules/utils/hooks/useGetBillingInfo";

/**
 * The switches that change how a question behaves rather than what the respondent reads. They sit in the
 * question's Settings tab, ahead of its validation rules; the Content tab keeps the text.
 */

type TUpdateElement = (elementIdx: number, updatedAttributes: Partial<TSurveyElement>) => void;

export const LongAnswerToggle = ({
  element,
  elementIdx,
  updateElement,
}: Readonly<{ element: TSurveyOpenTextElement; elementIdx: number; updateElement: TUpdateElement }>) => {
  const { t } = useTranslation();
  return (
    <AdvancedOptionToggle
      isChecked={element.longAnswer !== false}
      onToggle={(checked: boolean) => updateElement(elementIdx, { longAnswer: checked })}
      htmlId={`longAnswer-${element.id}`}
      title={t("workspace.surveys.edit.long_answer")}
      description={t("workspace.surveys.edit.long_answer_toggle_description")}
      disabled={element.inputType !== "text"}
      customContainerClass="p-0"
    />
  );
};

/** Scale questions: star ratings have no colours, so the switch is not offered for them. */
export const ColorCodingToggle = ({
  element,
  elementIdx,
  updateElement,
}: Readonly<{
  element: TSurveyNPSElement | TSurveyRatingElement | TSurveyCsatElement | TSurveyCesElement;
  elementIdx: number;
  updateElement: TUpdateElement;
}>) => {
  const { t } = useTranslation();
  if ("scale" in element && element.scale === "star") return null;
  return (
    <AdvancedOptionToggle
      isChecked={element.isColorCodingEnabled}
      onToggle={() => updateElement(elementIdx, { isColorCodingEnabled: !element.isColorCodingEnabled })}
      htmlId="isColorCodingEnabled"
      title={t("workspace.surveys.edit.add_color_coding")}
      description={t("workspace.surveys.edit.add_color_coding_description")}
      childBorder
      customContainerClass="p-0"
    />
  );
};

export const FileUploadSettings = ({
  element,
  elementIdx,
  updateElement,
  workspace,
  isFormbricksCloud,
}: Readonly<{
  element: TSurveyFileUploadElement;
  elementIdx: number;
  updateElement: TUpdateElement;
  workspace: TWorkspaceWithoutCustomCss;
  isFormbricksCloud: boolean;
}>) => {
  const { t } = useTranslation();
  const [isMaxSizeError, setIsMaxSizeError] = useState(false);
  const {
    billingInfo,
    error: billingInfoError,
    isLoading: billingInfoLoading,
  } = useGetBillingInfo(workspace.organizationId);

  const maxSizeInMBLimit = useMemo(() => {
    if (billingInfoError || billingInfoLoading || !billingInfo) {
      return 10;
    }

    const hasPaidCloudCapacity =
      billingInfo.limits.workspaces === null ||
      (typeof billingInfo.limits.workspaces === "number" && billingInfo.limits.workspaces > 1);

    if (hasPaidCloudCapacity) {
      // 1GB in MB
      return 1024;
    }

    return 10;
  }, [billingInfo, billingInfoError, billingInfoLoading]);

  const handleMaxSizeInMBToggle = (checked: boolean) => {
    const defaultMaxSizeInMB = isFormbricksCloud ? maxSizeInMBLimit : 1024;

    updateElement(elementIdx, { maxSizeInMB: checked ? defaultMaxSizeInMB : undefined });
  };

  return (
    <div className="flex flex-col gap-4">
      <AdvancedOptionToggle
        isChecked={element.allowMultipleFiles}
        onToggle={() => updateElement(elementIdx, { allowMultipleFiles: !element.allowMultipleFiles })}
        htmlId="allowMultipleFile"
        title={t("workspace.surveys.edit.allow_multiple_files")}
        description={t("workspace.surveys.edit.let_people_upload_up_to_25_files_at_the_same_time")}
        childBorder
        customContainerClass="p-0"></AdvancedOptionToggle>

      <AdvancedOptionToggle
        isChecked={!!element.maxSizeInMB}
        onToggle={handleMaxSizeInMBToggle}
        htmlId="maxFileSize"
        title={t("workspace.surveys.edit.max_file_size")}
        description={t("workspace.surveys.edit.limit_the_maximum_file_size")}
        childBorder
        customContainerClass="p-0">
        <label htmlFor="autoCompleteResponses" className="cursor-pointer bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">
            <Trans
              i18nKey="workspace.surveys.edit.limit_upload_file_size_to_mb"
              components={{
                fileSizeInput: (
                  <Input
                    autoFocus
                    type="number"
                    id="fileSizeLimit"
                    min={1}
                    value={element.maxSizeInMB}
                    onChange={(e) => {
                      const parsedValue = Number.parseInt(e.target.value, 10);

                      if (isFormbricksCloud && parsedValue > maxSizeInMBLimit) {
                        toast.error(
                          t("workspace.surveys.edit.max_file_size_limit_is_mb", {
                            maxSize: maxSizeInMBLimit,
                          })
                        );
                        setIsMaxSizeError(true);
                        updateElement(elementIdx, { maxSizeInMB: maxSizeInMBLimit });
                        return;
                      }

                      // A file size limit below 1 MB is meaningless, so clamp zero and negative values.
                      updateElement(elementIdx, { maxSizeInMB: Math.max(1, parsedValue) });
                    }}
                    className="mr-2 ml-2 inline w-20 bg-white text-center text-sm"
                  />
                ),
              }}
            />
          </p>
          {isMaxSizeError && (
            <p className="text-xs text-red-500">
              <Trans
                i18nKey="workspace.surveys.edit.max_file_size_limit_is_mb_upgrade"
                values={{ maxSize: maxSizeInMBLimit }}
                components={{
                  upgradeLink: (
                    <Link
                      className="underline"
                      target="_blank"
                      href={`/organizations/${workspace.organizationId}/settings/billing`}
                    />
                  ),
                }}
              />
            </p>
          )}
        </label>
      </AdvancedOptionToggle>
    </div>
  );
};
