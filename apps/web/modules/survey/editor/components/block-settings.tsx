"use client";

import { type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { addMultiLanguageLabels, extractLanguageCodes } from "@/lib/i18n/utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { fillEmptyBlockButtonLabels } from "@/modules/survey/editor/lib/blocks";

interface BlockSettingsProps {
  localSurvey: TSurvey;
  block: TSurveyBlock;
  blockIndex: number;
  selectedLanguageCode: string;
  updateBlockButtonLabel: (
    blockIndex: number,
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString | undefined
  ) => void;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isLastBlock: boolean;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
}

export const BlockSettings = ({
  localSurvey,
  block,
  blockIndex,
  selectedLanguageCode,
  updateBlockButtonLabel,
  locale,
  isStorageConfigured,
  isLastBlock,
  setLocalSurvey,
}: Readonly<BlockSettingsProps>) => {
  const { t } = useTranslation();

  const updateEmptyButtonLabels = (
    labelKey: "buttonLabel" | "backButtonLabel",
    labelValue: TI18nString,
    skipBlockIndex: number
  ) => {
    // Update button labels for all blocks except the one at skipBlockIndex. Reads the latest state, not
    // the rendered snapshot, which a memoized block card may hold from before other blocks' edits.
    setLocalSurvey((prevSurvey) =>
      fillEmptyBlockButtonLabels(prevSurvey, labelKey, labelValue, skipBlockIndex, selectedLanguageCode)
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex max-w-[300px] flex-col gap-4">
        <ElementFormInput
          id="buttonLabel"
          value={block.buttonLabel}
          label={t("workspace.surveys.edit.button_label")}
          localSurvey={localSurvey}
          elementIdx={blockIndex}
          isInvalid={false}
          updateElement={(_, updatedAttributes) => {
            if ("buttonLabel" in updatedAttributes) {
              const languageSymbols = extractLanguageCodes(localSurvey.languages ?? []);
              const buttonLabel = updatedAttributes.buttonLabel as TI18nString;
              const existingLabel = block.buttonLabel || {};
              const updatedButtonLabel = addMultiLanguageLabels(
                {
                  ...existingLabel,
                  [selectedLanguageCode]: buttonLabel[selectedLanguageCode],
                },
                languageSymbols
              );
              updateBlockButtonLabel(blockIndex, "buttonLabel", updatedButtonLabel);
            }
          }}
          placeholder={t("common.next")}
          locale={locale}
          isStorageConfigured={isStorageConfigured}
          onBlur={(e) => {
            const languageSymbols = extractLanguageCodes(localSurvey.languages ?? []);
            const existingLabel = block.buttonLabel || {};
            const translatedNextButtonLabel = addMultiLanguageLabels(
              {
                ...existingLabel,
                [selectedLanguageCode]: e.target.value,
              },
              languageSymbols
            );
            updateBlockButtonLabel(blockIndex, "buttonLabel", translatedNextButtonLabel);
            // Don't propagate to last block
            const lastBlockIndex = localSurvey.blocks.length - 1;
            if (blockIndex !== lastBlockIndex && !isLastBlock) {
              updateEmptyButtonLabels("buttonLabel", translatedNextButtonLabel, lastBlockIndex);
            }
          }}
        />
        {blockIndex !== 0 && (
          <ElementFormInput
            id="backButtonLabel"
            value={block.backButtonLabel}
            label={t("workspace.surveys.edit.back_button_label")}
            localSurvey={localSurvey}
            elementIdx={blockIndex}
            isInvalid={false}
            updateElement={(_, updatedAttributes) => {
              if ("backButtonLabel" in updatedAttributes) {
                const backButtonLabel = updatedAttributes.backButtonLabel as TI18nString;
                updateBlockButtonLabel(blockIndex, "backButtonLabel", {
                  ...block.backButtonLabel,
                  [selectedLanguageCode]: backButtonLabel[selectedLanguageCode],
                });
              }
            }}
            placeholder={t("common.back")}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
            onBlur={(e) => {
              const languageSymbols = extractLanguageCodes(localSurvey.languages ?? []);
              const existingLabel = block.backButtonLabel || {};
              const translatedBackButtonLabel = addMultiLanguageLabels(
                {
                  ...existingLabel,
                  [selectedLanguageCode]: e.target.value,
                },
                languageSymbols
              );
              updateBlockButtonLabel(blockIndex, "backButtonLabel", translatedBackButtonLabel);
              updateEmptyButtonLabels("backButtonLabel", translatedBackButtonLabel, blockIndex);
            }}
          />
        )}
      </div>
    </div>
  );
};
