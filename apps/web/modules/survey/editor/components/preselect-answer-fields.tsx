"use client";

import { useTranslation } from "react-i18next";
import type { TActionPreselectAnswer } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { PRESELECT_ANSWER_MAX_TEXT_LENGTH } from "@formbricks/types/surveys/preselect-answer";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getEmptyPreselectValue } from "@/lib/surveyLogic/utils";
import {
  getNextPreselectChoiceIds,
  getPreselectChoiceOptions,
  getPreselectTargetOptions,
} from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Input } from "@/modules/ui/components/input";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";

interface PreselectAnswerFieldsProps {
  readonly id: string;
  readonly action: TActionPreselectAnswer;
  readonly localSurvey: TSurvey;
  /** The block the rule follows; `-1` before the first question. Only later questions are offered. */
  readonly scopeBlockIdx: number;
  readonly onChange: (values: Partial<TActionPreselectAnswer>) => void;
}

/**
 * "Pre-select answer [question] [answer]" (ENG-7437): the question a later page opens with an answer
 * in, then that answer: one option of a single select, any of a multi select, or a free text value.
 * Picking another question starts its answer over, since options belong to their question.
 */
export function PreselectAnswerFields({
  id,
  action,
  localSurvey,
  scopeBlockIdx,
  onChange,
}: PreselectAnswerFieldsProps) {
  const { t } = useTranslation();
  const elements = getElementsFromBlocks(localSurvey.blocks);
  const element = elements.find((candidate) => candidate.id === action.target);

  const changeTarget = (target: string) => {
    if (target === action.target) return;
    const type = elements.find((candidate) => candidate.id === target)?.type;
    onChange({ target, value: getEmptyPreselectValue(type) });
  };

  const renderAnswer = () => {
    if (!element) return null;

    if (element.type === TSurveyElementTypeEnum.OpenText) {
      const isNumber = element.inputType === "number";
      return (
        <Input
          id={`${id}-value`}
          type={isNumber ? "number" : "text"}
          className="h-10 bg-white"
          maxLength={PRESELECT_ANSWER_MAX_TEXT_LENGTH}
          aria-label={t("workspace.surveys.edit.flow.preselect_answer_value")}
          placeholder={t("workspace.surveys.edit.flow.preselect_answer_value")}
          value={action.value.type === "static" ? action.value.value : ""}
          onChange={(event) => onChange({ value: { type: "static", value: event.target.value } })}
        />
      );
    }

    const isMulti = element.type === TSurveyElementTypeEnum.MultipleChoiceMulti;
    const choiceIdsNow = action.value.type === "choices" ? action.value.choiceIds : [];
    return (
      <InputCombobox
        id={`${id}-choices`}
        key={`${id}-choices-${element.id}`}
        showSearch={true}
        allowMultiSelect={isMulti}
        showCheckIcon={isMulti}
        aria-label={t("workspace.surveys.edit.flow.preselect_answer_options")}
        placeholder={t("workspace.surveys.edit.flow.preselect_answer_options")}
        options={getPreselectChoiceOptions(element)}
        value={isMulti ? [...choiceIdsNow] : (choiceIdsNow[0] ?? null)}
        onChangeValue={(val: string | number | string[]) => {
          const picked = Array.isArray(val) ? val : [String(val)];
          const choiceIds = isMulti ? getNextPreselectChoiceIds(choiceIdsNow, picked) : picked;
          onChange({ value: { type: "choices", choiceIds } });
        }}
        comboboxClasses="grow"
      />
    );
  };

  return (
    <>
      <div className="min-w-0">
        <InputCombobox
          id={`${id}-target`}
          key={`${id}-target`}
          showSearch={true}
          wideDropdown={true}
          aria-label={t("workspace.surveys.edit.flow.preselect_answer_question")}
          placeholder={t("workspace.surveys.edit.flow.preselect_answer_question")}
          emptyDropdownText={t("workspace.surveys.edit.flow.preselect_answer_no_questions")}
          options={getPreselectTargetOptions(localSurvey, scopeBlockIdx, t)}
          value={action.target || null}
          onChangeValue={(val: string | number | string[]) => changeTarget(String(val))}
          comboboxClasses="grow"
        />
      </div>
      <div className="min-w-0">{renderAnswer()}</div>
    </>
  );
}
