"use client";

import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  TMultipleChoiceOptionDisplayType,
  TSurveyElement,
  TSurveyElementTypeEnum,
} from "@formbricks/types/surveys/elements";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import {
  ColorCodingToggle,
  FileUploadSettings,
  LongAnswerToggle,
} from "@/modules/survey/editor/components/element-toggle-settings";
import { ValidationRulesEditor } from "@/modules/survey/editor/components/validation-rules-editor";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";

interface ElementSettingsProps {
  element: TSurveyElement;
  elementIdx: number;
  updateElement: (elementIdx: number, updatedAttributes: Record<string, unknown>) => void;
  /** Only the file upload question reads these: its size limit depends on the plan. */
  workspace?: TWorkspaceWithoutCustomCss;
  isFormbricksCloud?: boolean;
}

const OptionOrder = ({
  element,
  elementIdx,
  updateElement,
}: Readonly<{
  element: TSurveyElement;
  elementIdx: number;
  updateElement: ElementSettingsProps["updateElement"];
}>) => {
  const { t } = useTranslation();
  if (!("shuffleOption" in element)) return null;
  return (
    <div>
      <Label>{t("workspace.surveys.edit.option_order")}</Label>
      <div className="mt-2">
        <ShuffleOptionSelect
          elementIdx={elementIdx}
          shuffleOption={element.shuffleOption}
          updateElement={updateElement}
          shuffleOptionsTypes={getShuffleOptionsTypes(element, t)}
        />
      </div>
    </div>
  );
};

const getShuffleOptionsTypes = (element: TSurveyElement, t: TFunction) => {
  const choices = "choices" in element ? element.choices : [];
  const hasSpecialChoice = choices.some((choice) => choice.id === "other" || choice.id === "none");
  const hasOtherChoice = choices.some((choice) => choice.id === "other");
  const isRanking = element.type === TSurveyElementTypeEnum.Ranking;
  const isMatrix = element.type === TSurveyElementTypeEnum.Matrix;

  // "Other" stays last, so a shuffle that can move the last choice is not offered alongside it.
  let canMoveLast = !hasSpecialChoice;
  if (isRanking) canMoveLast = !hasOtherChoice;
  if (isMatrix) canMoveLast = true;

  return {
    none: { id: "none", label: t("workspace.surveys.edit.keep_current_order"), show: true },
    all: {
      id: "all",
      label: t("workspace.surveys.edit.randomize_all"),
      show: canMoveLast && (!isRanking || choices.length > 0),
    },
    exceptLast: {
      id: "exceptLast",
      label: t("workspace.surveys.edit.randomize_all_except_last"),
      show: true,
    },
    reverseOrderOccasionally: {
      id: "reverseOrderOccasionally",
      label: t("workspace.surveys.edit.reverse_order_occasionally"),
      show: canMoveLast,
    },
    reverseOrderExceptLast: {
      id: "reverseOrderExceptLast",
      label: t("workspace.surveys.edit.reverse_order_occasionally_except_last"),
      show: true,
    },
  };
};

/**
 * The question settings that used to sit at the bottom of each question form: option order, display
 * options and validation rules. They are the first part of a question's Settings tab; the Recode
 * section follows.
 */
export const ElementSettings = ({
  element,
  elementIdx,
  updateElement,
  workspace,
  isFormbricksCloud = false,
}: Readonly<ElementSettingsProps>) => {
  const { t } = useTranslation();

  const updateValidation = (validation: unknown) => updateElement(elementIdx, { validation });

  switch (element.type) {
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return (
        <div className="flex flex-col gap-4">
          <OptionOrder element={element} elementIdx={elementIdx} updateElement={updateElement} />
          <div>
            <Label>{t("workspace.surveys.edit.display_type")}</Label>
            <div className="mt-2">
              <OptionsSwitch
                options={[
                  { value: "list", label: t("workspace.surveys.edit.list") },
                  { value: "dropdown", label: t("workspace.surveys.edit.dropdown") },
                ]}
                currentOption={element.displayType ?? "list"}
                handleOptionChange={(value: string) =>
                  updateElement(elementIdx, { displayType: value as TMultipleChoiceOptionDisplayType })
                }
              />
            </div>
          </div>
          {element.type === TSurveyElementTypeEnum.MultipleChoiceMulti && (
            <ValidationRulesEditor
              elementType={element.type}
              validation={element.validation}
              onUpdateValidation={updateValidation}
              element={element}
            />
          )}
        </div>
      );

    case TSurveyElementTypeEnum.Ranking:
    case TSurveyElementTypeEnum.Matrix:
      return (
        <div className="flex flex-col gap-4">
          <OptionOrder element={element} elementIdx={elementIdx} updateElement={updateElement} />
          <ValidationRulesEditor
            elementType={element.type}
            validation={element.validation}
            onUpdateValidation={updateValidation}
            element={element}
          />
        </div>
      );

    case TSurveyElementTypeEnum.PictureSelection:
      return element.allowMulti ? (
        <ValidationRulesEditor
          elementType={element.type}
          validation={element.validation}
          onUpdateValidation={updateValidation}
          element={element}
        />
      ) : null;

    case TSurveyElementTypeEnum.OpenText:
      return (
        <div className="flex flex-col gap-4">
          <LongAnswerToggle element={element} elementIdx={elementIdx} updateElement={updateElement} />
          <ValidationRulesEditor
            elementType={element.type}
            validation={element.validation}
            onUpdateValidation={updateValidation}
            inputType={element.inputType ?? "text"}
            onUpdateInputType={(newInputType) =>
              updateElement(elementIdx, { inputType: newInputType, longAnswer: newInputType === "text" })
            }
          />
        </div>
      );

    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
      return <ColorCodingToggle element={element} elementIdx={elementIdx} updateElement={updateElement} />;

    case TSurveyElementTypeEnum.FileUpload:
      return (
        <div className="flex flex-col gap-4">
          {workspace && (
            <FileUploadSettings
              element={element}
              elementIdx={elementIdx}
              updateElement={updateElement}
              workspace={workspace}
              isFormbricksCloud={isFormbricksCloud}
            />
          )}
          <ValidationRulesEditor
            elementType={element.type}
            validation={element.validation}
            onUpdateValidation={updateValidation}
            element={element}
          />
        </div>
      );

    case TSurveyElementTypeEnum.Address:
      return (
        <ValidationRulesEditor
          elementType={element.type}
          validation={element.validation}
          onUpdateValidation={updateValidation}
          element={element}
        />
      );

    case TSurveyElementTypeEnum.ContactInfo:
    case TSurveyElementTypeEnum.Date:
      return (
        <ValidationRulesEditor
          elementType={element.type}
          validation={element.validation}
          onUpdateValidation={updateValidation}
        />
      );

    default:
      return null;
  }
};
