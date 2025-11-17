"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { ConditionalLogic } from "@/modules/survey/editor/components/conditional-logic";

interface BlockSettingsProps {
  localSurvey: TSurvey;
  block: TSurveyBlock;
  blockIndex: number;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  updateBlockButtonLabel: (
    blockIndex: number,
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString | undefined
  ) => void;
  updateBlockLogic: (blockIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (blockIdx: number, logicFallback: string | undefined) => void;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isLastBlock: boolean;
}

export const BlockSettings = ({
  localSurvey,
  block,
  blockIndex,
  selectedLanguageCode,
  setSelectedLanguageCode,
  updateBlockButtonLabel,
  updateBlockLogic,
  updateBlockLogicFallback,
  locale,
  isStorageConfigured,
  isLastBlock,
}: BlockSettingsProps) => {
  const { t } = useTranslation();

  // Use the first element in the block as a representative for logic
  const firstElement = block.elements[0];
  const blockLogic = block.logic ?? [];

  // Auto-open if block has logic configured
  const [open, setOpen] = useState(blockLogic.length > 0);

  const updateEmptyButtonLabels = (
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString,
    skipBlockIndex: number
  ) => {
    // Update button labels for all blocks except the one at skipBlockIndex
    localSurvey.blocks.forEach((block, index) => {
      if (index === skipBlockIndex) return;
      const currentLabel = block[labelKey];
      if (!currentLabel || currentLabel[selectedLanguageCode]?.trim() === "") {
        updateBlockButtonLabel(index, labelKey, labelValue);
      }
    });
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="w-full rounded-lg">
      <Collapsible.CollapsibleTrigger
        className="flex items-center text-sm text-slate-700"
        aria-label="Toggle advanced settings">
        {open ? <ChevronDownIcon className="mr-1 h-4 w-3" /> : <ChevronRightIcon className="mr-2 h-4 w-3" />}
        {open
          ? t("environments.surveys.edit.hide_block_settings")
          : t("environments.surveys.edit.show_block_settings")}
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <div className="mt-2 space-y-4">
          <div className="flex space-x-2">
            {blockIndex !== 0 && (
              <QuestionFormInput
                id="backButtonLabel"
                value={block.backButtonLabel}
                label={t("environments.surveys.edit.back_button_label")}
                localSurvey={localSurvey}
                questionIdx={blockIndex}
                isInvalid={false}
                updateQuestion={(_, updatedAttributes) => {
                  if ("backButtonLabel" in updatedAttributes) {
                    const backButtonLabel = updatedAttributes.backButtonLabel as TI18nString;
                    updateBlockButtonLabel(blockIndex, "backButtonLabel", {
                      ...block.backButtonLabel,
                      [selectedLanguageCode]: backButtonLabel[selectedLanguageCode],
                    });
                  }
                }}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                placeholder={t("common.back")}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                onBlur={(e) => {
                  if (!block.backButtonLabel) return;
                  const translatedBackButtonLabel = {
                    ...block.backButtonLabel,
                    [selectedLanguageCode]: e.target.value,
                  };
                  updateBlockButtonLabel(blockIndex, "backButtonLabel", translatedBackButtonLabel);
                  updateEmptyButtonLabels("backButtonLabel", translatedBackButtonLabel, blockIndex);
                }}
              />
            )}
            <QuestionFormInput
              id="buttonLabel"
              value={block.buttonLabel}
              label={t("environments.surveys.edit.button_label")}
              localSurvey={localSurvey}
              questionIdx={blockIndex}
              isInvalid={false}
              updateQuestion={(_, updatedAttributes) => {
                if ("buttonLabel" in updatedAttributes) {
                  const buttonLabel = updatedAttributes.buttonLabel as TI18nString;
                  updateBlockButtonLabel(blockIndex, "buttonLabel", {
                    ...block.buttonLabel,
                    [selectedLanguageCode]: buttonLabel[selectedLanguageCode],
                  });
                }
              }}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              placeholder={t("common.next")}
              locale={locale}
              isStorageConfigured={isStorageConfigured}
              onBlur={(e) => {
                if (!block.buttonLabel) return;
                const translatedNextButtonLabel = {
                  ...block.buttonLabel,
                  [selectedLanguageCode]: e.target.value,
                };
                updateBlockButtonLabel(blockIndex, "buttonLabel", translatedNextButtonLabel);
                // Don't propagate to last block
                const lastBlockIndex = localSurvey.blocks.length - 1;
                if (blockIndex !== lastBlockIndex && !isLastBlock) {
                  updateEmptyButtonLabels("buttonLabel", translatedNextButtonLabel, lastBlockIndex);
                }
              }}
            />
          </div>

          {/* Conditional Logic */}
          {firstElement && (
            <ConditionalLogic
              localSurvey={localSurvey}
              block={block}
              blockIdx={blockIndex}
              updateBlockLogic={updateBlockLogic}
              updateBlockLogicFallback={updateBlockLogicFallback}
            />
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
