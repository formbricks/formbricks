"use client";

import type { TFunction } from "i18next";
import { EyeIcon, EyeOffIcon, TrashIcon } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { type TOptionLike, type TOptionListKey, getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { cn } from "@/lib/cn";
import { getLocalizedValue } from "@/lib/i18n/utils";
import {
  ShowIfConditionsEditor,
  ShowIfPopoverFrame,
  useShowIfScope,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import {
  type TShowIfTarget,
  canAddShowIf,
  createShowIf,
  setOptionHidden,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { Popover, PopoverTrigger } from "@/modules/ui/components/popover";
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
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
            // The question list sits inside the block row: don't collapse it.
            onClick={(event) => event.stopPropagation()}>
            <EyeIcon className="size-3" aria-hidden="true" />
            {t("workspace.surveys.edit.flow.show_options_if")}
          </button>
        )}
      </PopoverTrigger>
      {/* Mounted only while open: its scope is computed for the open popover alone. */}
      {isOpen && (
        <OptionsShowIfEditor
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          blockIdx={blockIdx}
          elementIdx={elementIdx}
          optionLists={optionLists}
          onClose={() => onOpenChange(false)}
        />
      )}
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

/** A list's heading. Literal keys, so the translation scan sees them. */
const getListHeading = (listKey: TOptionListKey, t: TFunction): string => {
  switch (listKey) {
    case "rows":
      return t("workspace.surveys.edit.flow.rows");
    case "columns":
      return t("workspace.surveys.edit.flow.columns");
    default:
      return t("workspace.surveys.edit.flow.options");
  }
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
  const element = localSurvey.blocks[blockIdx]?.elements[elementIdx];

  // An option's show-if sees what its question's sees.
  const { scope, getDefaultOperator } = useShowIfScope(localSurvey, {
    type: "element",
    blockIdx,
    elementIdx,
  });

  if (!element) return null;

  const addCondition = (target: TOptionTarget, key: string) => {
    const showIf = createShowIf(localSurvey, target, (start) => getDefaultOperatorForElement(start, t));
    if (!showIf) return;
    setLocalSurvey((survey) => updateShowIf(survey, target, () => showIf));
    setEditingKey(key);
  };

  const removeCondition = (target: TOptionTarget) => {
    setLocalSurvey((survey) => updateShowIf(survey, target, () => undefined));
    setEditingKey(null);
  };

  return (
    <ShowIfPopoverFrame
      title={t("workspace.surveys.edit.flow.options_shown_if")}
      help={t("workspace.surveys.edit.flow.options_shown_if_help")}
      info={{
        label: t("workspace.surveys.edit.flow.options_shown_if_info_label"),
        content: t("workspace.surveys.edit.flow.options_shown_if_info"),
      }}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" size="sm" onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      }>
      <div className="flex flex-col gap-3">
        {optionLists.map((listKey) => {
          const items = getOptionList<TEditableOption>(element, listKey);
          return (
            <section key={listKey} className="flex flex-col gap-1">
              {optionLists.length > 1 && (
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {getListHeading(listKey, t)}
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
                            <ShowIfConditionsEditor
                              conditions={item.showIf}
                              scope={scope}
                              getDefaultOperator={getDefaultOperator}
                              onConditionsChange={(updater) =>
                                setLocalSurvey((survey) => updateShowIf(survey, target, updater))
                              }
                            />
                            <div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => removeCondition(target)}>
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
      </div>
    </ShowIfPopoverFrame>
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

/**
 * One option: its label, how it is shown (Hidden, "Shown if …" or "Always shown"), and the toggle.
 * A click anywhere on the card opens its condition, or adds one when it has none; the Hidden toggle
 * and its (i) keep their clicks to themselves.
 */
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
  const { t, i18n } = useTranslation();
  const isHidden = item.hidden === true;
  const showIf: TConditionGroup | undefined = item.showIf;
  const switchId = `option-hidden-${item.id}`;
  // A Hidden option without a condition offers none to add (its card says only "Hidden").
  const addOnClick = isHidden ? undefined : onAddCondition;
  const onCardClick = showIf ? onToggleEditing : addOnClick;

  return (
    <li className="flex flex-col">
      {/* The card is a mouse shortcut for the "Shown if …" and "Add condition" buttons inside it,
          which keyboard users reach on their own. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- see above */}
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-3 py-2",
          onCardClick && "cursor-pointer hover:bg-slate-50"
        )}
        onClick={onCardClick}>
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
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleEditing();
                }}>
                {t("workspace.surveys.edit.flow.shown_if", {
                  conditions: describeConditionGroup(showIf, localSurvey, t, {
                    locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
                  }),
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
                        onClick={(event) => {
                          event.stopPropagation();
                          onAddCondition();
                        }}>
                        {t("workspace.surveys.edit.flow.add_condition")}
                      </button>
                    </>
                  )}
                </span>
              )
            )}
          </div>
        </div>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only keeps the card's mouse shortcut off the toggle */}
        <div className="flex shrink-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
          <label htmlFor={switchId} className="text-xs text-slate-600">
            {t("workspace.surveys.edit.flow.hide_option")}
          </label>
          <InfoTooltip label={t("workspace.surveys.edit.flow.hidden_option_info_label")}>
            {t("workspace.surveys.edit.flow.hidden_option_help")}
          </InfoTooltip>
          <Switch id={switchId} checked={isHidden} onCheckedChange={onHiddenChange} />
        </div>
      </div>
      {isEditing && <div className="px-3 pb-2">{conditionsEditor}</div>}
    </li>
  );
}
