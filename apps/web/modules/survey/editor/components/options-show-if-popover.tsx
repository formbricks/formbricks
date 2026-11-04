"use client";

import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LayersIcon,
  ListFilterIcon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import { canHaveCopiedOptions, getOptionsCopiedFrom } from "@formbricks/types/surveys/copied-options";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { type TOptionLike, type TOptionListKey, getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import {
  ShowIfConditionsEditor,
  ShowIfPopoverFrame,
  useShowIfScope,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import {
  copyOptionsAgain,
  countOptionsToCopyAgain,
  getCopySourceCandidates,
  linkCopiedOptions,
  unlinkCopiedOptions,
} from "@/modules/survey/editor/lib/copied-options-editing";
import { describeConditionGroup } from "@/modules/survey/editor/lib/flow-outline-text";
import { getElementLock } from "@/modules/survey/editor/lib/published-lock";
import {
  type TShowIfTarget,
  canAddShowIf,
  createShowIf,
  setOptionHidden,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { getDefaultOperatorForElement, getElementPickerLabel } from "@/modules/survey/editor/lib/utils";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Label } from "@/modules/ui/components/label";
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
  /** ENG-6938: the question the options are copied from, when they are. */
  readonly copiedFromId?: string;
  /** The saved survey, for the published lock: a first copy keeps the options that existed at launch. */
  readonly persistedSurvey?: TSurvey;
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * The "Options shown if" popover of a question on the Flow tab (ENG-6937): a condition per option,
 * matrix row or matrix column ("Always shown · Add condition"), and a Hidden toggle. Hidden reads
 * differently from conditional (P1): it wins over the condition and is labelled "Hidden".
 *
 * Opened from the question's option badges, or from a hover action when it has none yet.
 *
 * A choice or picture question also picks here which earlier question its options are copied from
 * (ENG-6938, "Options copied from"), and copies them again after the source gained options.
 */
export function OptionsShowIfPopover({
  localSurvey,
  setLocalSurvey,
  blockIdx,
  elementIdx,
  optionLists,
  showIfCount,
  hiddenCount,
  copiedFromId,
  persistedSurvey,
  isOpen,
  onOpenChange,
}: OptionsShowIfPopoverProps) {
  const { t } = useTranslation();
  const hasBadges = showIfCount > 0 || hiddenCount > 0 || copiedFromId !== undefined;
  const copiedFrom = copiedFromId
    ? localSurvey.blocks.flatMap((block) => block.elements).find((element) => element.id === copiedFromId)
    : undefined;

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {hasBadges ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
            aria-label={t("workspace.surveys.edit.flow.edit_options_shown_if")}
            onClick={(event) => event.stopPropagation()}>
            {copiedFromId !== undefined && (
              <Badge
                type="gray"
                size="tiny"
                icon={<LayersIcon />}
                text={t("workspace.surveys.edit.flow.options_copied_from", {
                  question: copiedFrom ? getElementBadgeText(copiedFrom) : copiedFromId,
                })}
              />
            )}
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
      {/* Mounted only while open: its scope is computed for the open popover alone. */}
      {isOpen && (
        <OptionsShowIfEditor
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          blockIdx={blockIdx}
          elementIdx={elementIdx}
          optionLists={optionLists}
          persistedSurvey={persistedSurvey}
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
  readonly persistedSurvey?: TSurvey;
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
  persistedSurvey,
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
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{t("workspace.surveys.edit.flow.hidden_option_help")}</p>
          <Button type="button" size="sm" onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      }>
      <div className="flex flex-col gap-3">
        {canHaveCopiedOptions(element.type) && (
          <CopiedOptionsSource
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            blockIdx={blockIdx}
            elementIdx={elementIdx}
            persistedSurvey={persistedSurvey}
          />
        )}
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

interface CopiedOptionsSourceProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly blockIdx: number;
  readonly elementIdx: number;
  readonly persistedSurvey?: TSurvey;
}

const NOT_COPIED = "__not_copied__";

/**
 * "Options copied from" (ENG-6938): the earlier question whose options this one copies, with their
 * ids and codes, each shown only if it was picked there; "Copy again" brings in options the source
 * gained since. Picking "Not copied" drops the link and keeps the options.
 */
function CopiedOptionsSource({
  localSurvey,
  setLocalSurvey,
  blockIdx,
  elementIdx,
  persistedSurvey,
}: CopiedOptionsSourceProps) {
  const { t } = useTranslation();
  const target = { blockIdx, elementIdx };
  const element = localSurvey.blocks[blockIdx]?.elements[elementIdx];
  const copiedFrom = getOptionsCopiedFrom(element);
  const candidates = getCopySourceCandidates(localSurvey, target);
  const newCount = countOptionsToCopyAgain(localSurvey, target);
  const id = `copied-from-${element?.id ?? elementIdx}`;

  if (!element || (candidates.length === 0 && !copiedFrom)) return null;

  // A first copy replaces the question's own options, except those a published survey must keep.
  const lock = getElementLock(persistedSurvey ?? null, element.id);
  const settings = { createId, keepOptionId: (optionId: string) => lock.isOptionLocked("choices", optionId) };

  const options = [
    { label: t("workspace.surveys.edit.flow.not_copied"), value: NOT_COPIED },
    ...candidates.map((candidate) => ({
      label: getElementPickerLabel(localSurvey, candidate, t),
      value: candidate.id,
    })),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t("workspace.surveys.edit.flow.options_copied_from_label")}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <InputCombobox
          id={id}
          showSearch={candidates.length > 6}
          options={options}
          value={copiedFrom ?? NOT_COPIED}
          wideDropdown
          comboboxClasses="w-full max-w-[440px] bg-white"
          onChangeValue={(value) =>
            setLocalSurvey((survey) =>
              value === NOT_COPIED
                ? unlinkCopiedOptions(survey, target)
                : linkCopiedOptions(survey, target, String(value), settings)
            )
          }
        />
        {copiedFrom && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setLocalSurvey((survey) => copyOptionsAgain(survey, target, settings))}>
            {newCount > 0 ? <CopyIcon /> : <RefreshCwIcon />}
            {newCount > 0
              ? t("workspace.surveys.edit.flow.copy_again_new", { count: newCount })
              : t("workspace.surveys.edit.flow.copy_again")}
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">{t("workspace.surveys.edit.flow.options_copied_from_help")}</p>
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
