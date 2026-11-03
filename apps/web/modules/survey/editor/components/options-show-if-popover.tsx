"use client";

import { EyeIcon, EyeOffIcon, ListFilterIcon, TrashIcon } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { type TOptionLike, type TOptionListKey } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import {
  type TShowIfTarget,
  canAddShowIf,
  createShowIf,
  getShowIfScope,
  setOptionHidden,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { Switch } from "@/modules/ui/components/switch";

type TOptionTarget = Extract<TShowIfTarget, { type: "option" }>;
type TEditableOption = TOptionLike & { label?: Record<string, string>; imageUrl?: string };

interface OptionsShowIfPopoverProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly blockIdx: number;
  readonly elementIdx: number;
  /** The lists the popover edits: `["choices"]`, or a matrix's `["rows", "columns"]`. */
  readonly optionLists: TOptionListKey[];
  /** Options with their own show-if, and Hidden options: the badges that open the popover. */
  readonly showIfCount: number;
  readonly hiddenCount: number;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * The "Options shown if" popover of a question on the Flow tab (ENG-6937): a condition per option,
 * matrix row or matrix column ("Always shown · Add condition"), and a Hidden toggle. Hidden reads
 * differently from conditional (P1): it wins over the condition and is labelled "Hidden".
 *
 * Opened from the question's option badges, or from a hover action when it has none yet.
 */
export function OptionsShowIfPopover({
  localSurvey,
  setLocalSurvey,
  blockIdx,
  elementIdx,
  optionLists,
  showIfCount,
  hiddenCount,
  isOpen,
  onOpenChange,
}: OptionsShowIfPopoverProps) {
  const { t } = useTranslation();
  const hasBadges = showIfCount > 0 || hiddenCount > 0;

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {hasBadges ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
            aria-label={t("workspace.surveys.edit.flow.edit_options_shown_if")}
            onClick={(event) => event.stopPropagation()}>
            {showIfCount > 0 && (
              <Badge
                type="gray"
                size="tiny"
                icon={<EyeIcon />}
                text={t("workspace.surveys.edit.flow.options_show_if", { count: showIfCount })}
              />
            )}
            {hiddenCount > 0 && (
              <Badge
                type="gray"
                size="tiny"
                icon={<EyeOffIcon />}
                text={t("workspace.surveys.edit.flow.hidden_options", { count: hiddenCount })}
              />
            )}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden data-[state=open]:opacity-100"
            // The question list sits inside the block row: don't collapse it.
            onClick={(event) => event.stopPropagation()}>
            <ListFilterIcon className="size-3" aria-hidden="true" />
            {t("workspace.surveys.edit.flow.options_shown_if")}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(36rem,80vh)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        onFocusOutside={(event) => event.preventDefault()}>
        <OptionsShowIfEditor
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          blockIdx={blockIdx}
          elementIdx={elementIdx}
          optionLists={optionLists}
          onClose={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

interface OptionsShowIfEditorProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly blockIdx: number;
  readonly elementIdx: number;
  readonly optionLists: TOptionListKey[];
  readonly onClose: () => void;
}

const LIST_HEADING_KEY: Record<TOptionListKey, string> = {
  choices: "workspace.surveys.edit.flow.options",
  rows: "workspace.surveys.edit.flow.rows",
  columns: "workspace.surveys.edit.flow.columns",
};

/** The popover's content, mounted only while it is open. */
function OptionsShowIfEditor({
  localSurvey,
  setLocalSurvey,
  blockIdx,
  elementIdx,
  optionLists,
  onClose,
}: OptionsShowIfEditorProps) {
  const { t } = useTranslation();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const element = localSurvey.blocks[blockIdx]?.elements[elementIdx] as unknown as
    | Record<string, unknown>
    | undefined;

  // An option's show-if sees what its question's sees. Pickers read recalled headlines as plain text.
  const scope = useMemo(() => {
    const scoped = getShowIfScope(localSurvey, { type: "element", blockIdx, elementIdx });
    return { ...scoped, survey: replaceHeadlineRecall(scoped.survey, "default") };
  }, [localSurvey, blockIdx, elementIdx]);
  const nearest = scope.survey.blocks.flatMap((block) => block.elements).at(-1);
  const getDefaultOperator = (): TSurveyLogicConditionsOperator =>
    nearest ? getDefaultOperatorForElement(nearest, t) : "isSet";

  if (!element) return null;

  const addCondition = (target: TOptionTarget, key: string) => {
    const showIf = createShowIf(localSurvey, target, (start) => getDefaultOperatorForElement(start, t));
    if (!showIf) return;
    setLocalSurvey((survey) => updateShowIf(survey, target, () => showIf));
    setEditingKey(key);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {t("workspace.surveys.edit.flow.options_shown_if")}
        </p>
        <p className="text-xs text-slate-500">{t("workspace.surveys.edit.flow.options_shown_if_help")}</p>
      </div>
      {optionLists.map((listKey) => {
        const items = (Array.isArray(element[listKey]) ? element[listKey] : []) as TEditableOption[];
        return (
          <section key={listKey} className="flex flex-col gap-1">
            {optionLists.length > 1 && (
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {t(LIST_HEADING_KEY[listKey])}
              </p>
            )}
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {items.map((item, itemIdx) => {
                const target: TOptionTarget = {
                  type: "option",
                  blockIdx,
                  elementIdx,
                  listKey,
                  optionId: item.id,
                };
                const key = `${listKey}:${item.id}`;
                return (
                  <OptionRow
                    key={key}
                    label={
                      item.label
                        ? getTextContent(getLocalizedValue(item.label, "default")) || item.id
                        : t("workspace.surveys.edit.flow.picture_n", { n: itemIdx + 1 })
                    }
                    item={item}
                    localSurvey={localSurvey}
                    isEditing={editingKey === key}
                    onToggleEditing={() => setEditingKey(editingKey === key ? null : key)}
                    onAddCondition={
                      canAddShowIf(localSurvey, target) ? () => addCondition(target, key) : undefined
                    }
                    onHiddenChange={(hidden) =>
                      setLocalSurvey((survey) => setOptionHidden(survey, target, hidden))
                    }
                    conditionsEditor={
                      item.showIf ? (
                        <div className="flex flex-col gap-2">
                          <div className="overflow-x-auto pb-1 text-sm">
                            <LogicEditorConditions
                              conditions={item.showIf}
                              localSurvey={scope.survey}
                              scopeBlockIdx={scope.blockIdx}
                              getDefaultOperator={getDefaultOperator}
                              onConditionsChange={(updater) =>
                                setLocalSurvey((survey) => updateShowIf(survey, target, updater))
                              }
                            />
                          </div>
                          <div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setLocalSurvey((survey) => updateShowIf(survey, target, () => undefined));
                                setEditingKey(null);
                              }}>
                              <TrashIcon />
                              {t("workspace.surveys.edit.flow.remove_condition")}
                            </Button>
                          </div>
                        </div>
                      ) : null
                    }
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-slate-500">{t("workspace.surveys.edit.flow.hidden_option_help")}</p>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onClose}>
          {t("common.done")}
        </Button>
      </div>
    </div>
  );
}

interface OptionRowProps {
  readonly label: string;
  readonly item: TEditableOption;
  readonly localSurvey: TSurvey;
  readonly isEditing: boolean;
  readonly onToggleEditing: () => void;
  /** Absent when there is nothing before the question to depend on. */
  readonly onAddCondition?: () => void;
  readonly onHiddenChange: (hidden: boolean) => void;
  readonly conditionsEditor: ReactNode;
}

/** One option: its label, how it is shown (Hidden, "Shown if …" or "Always shown"), and the toggle. */
function OptionRow({
  label,
  item,
  localSurvey,
  isEditing,
  onToggleEditing,
  onAddCondition,
  onHiddenChange,
  conditionsEditor,
}: OptionRowProps) {
  const { t } = useTranslation();
  const isHidden = item.hidden === true;
  const showIf: TConditionGroup | undefined = item.showIf;
  const switchId = `option-hidden-${item.id}`;

  return (
    <li className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={`truncate text-sm font-medium ${isHidden ? "text-slate-400 line-through" : "text-slate-800"}`}>
            {label}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {isHidden && (
              <Badge
                type="warning"
                size="tiny"
                icon={<EyeOffIcon />}
                text={t("workspace.surveys.edit.flow.hidden_badge")}
              />
            )}
            {showIf ? (
              <button
                type="button"
                className={`rounded-sm text-left underline-offset-2 hover:underline focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden ${isHidden ? "text-slate-400" : "text-slate-700"}`}
                aria-expanded={isEditing}
                onClick={onToggleEditing}>
                {t("workspace.surveys.edit.flow.shown_if", {
                  conditions: describeConditionGroup(showIf, localSurvey, t),
                })}
              </button>
            ) : (
              !isHidden && (
                <span>
                  {t("workspace.surveys.edit.flow.always_shown")}
                  {onAddCondition && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="rounded-sm text-slate-700 underline-offset-2 hover:underline focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
                        onClick={onAddCondition}>
                        {t("workspace.surveys.edit.flow.add_condition")}
                      </button>
                    </>
                  )}
                </span>
              )
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor={switchId} className="text-xs text-slate-600">
            {t("workspace.surveys.edit.flow.hide_option")}
          </label>
          <Switch id={switchId} checked={isHidden} onCheckedChange={onHiddenChange} />
        </div>
      </div>
      {isEditing && conditionsEditor}
    </li>
  );
}
