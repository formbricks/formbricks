"use client";

import type { TFunction } from "i18next";
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "lucide-react";
import { type Dispatch, type RefObject, type ReactNode, type SetStateAction, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { type TOptionLike, type TOptionListKey, getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { cn } from "@/lib/cn";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { FlowTextParts, useElementIcons } from "@/modules/survey/editor/components/reference-chip";
import {
  AddConditionCell,
  SHOW_IF_CELL_CLASS,
  ShowIfConditionsEditor,
  ShowIfPopoverBoundary,
  ShowIfPopoverFrame,
  useShowIfAnchor,
  useShowIfScope,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { describeIfConditionParts } from "@/modules/survey/editor/lib/flow-outline-text";
import { toPlainText } from "@/modules/survey/editor/lib/reference-chips";
import {
  type TShowIfTarget,
  applyOptionsShowIfDraft,
  canAddShowIf,
  createDraftShowIf,
  getShowIf,
  hasUnchosenField,
  isShowIfComplete,
  setOptionHidden,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { Popover, PopoverAnchor, PopoverTrigger } from "@/modules/ui/components/popover";
import { Switch } from "@/modules/ui/components/switch";

type TOptionTarget = Extract<TShowIfTarget, { type: "option" }>;
type TEditableOption = TOptionLike & { label?: Record<string, string>; imageUrl?: string };

/** A column header of the options table. */
const OPTION_TABLE_HEADER_CLASS =
  "flex items-center gap-1 border-b border-slate-200 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase";

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
  /** What opens the popover while nothing is set: the Flow tab's faint cell by default. */
  readonly newTrigger?: ReactNode;
  /** The trigger sits right under its own heading (the Questions tab): the popover leaves it out. */
  readonly hideHeading?: boolean;
}

/**
 * What a question's "Show options if…" cell reads (ENG-6969 T10): "1 option" with an eye for options
 * with a show-if, "1 hidden" for Hidden ones. The column header names the level.
 */
export function OptionsShowIfCounts({
  showIfCount,
  hiddenCount,
}: {
  readonly showIfCount: number;
  readonly hiddenCount: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      {showIfCount > 0 && (
        <>
          <EyeIcon aria-hidden="true" />
          <span className="truncate">
            {t("workspace.surveys.edit.flow.options_count", { count: showIfCount })}
          </span>
        </>
      )}
      {hiddenCount > 0 && (
        <>
          <EyeOffIcon aria-hidden="true" className={cn(showIfCount > 0 && "ml-1")} />
          <span className="truncate">
            {t("workspace.surveys.edit.flow.hidden_count", { count: hiddenCount })}
          </span>
        </>
      )}
    </>
  );
}

/**
 * The "Show options if…" popover of a question on the Flow tab (ENG-6937): a condition per option,
 * matrix row or matrix column, and a Hidden toggle. Hidden reads differently from conditional (P1): it
 * wins over the condition and is labelled "Hidden".
 *
 * Opened from the question's "Show options if…" cell: its counts, or "Add condition" when nothing is
 * set yet (ENG-6969 T10).
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
  newTrigger,
  hideHeading = false,
}: OptionsShowIfPopoverProps) {
  const { t } = useTranslation();
  const { triggerRef, anchorRef, hasAnchor } = useShowIfAnchor();
  const hasBadges = showIfCount > 0 || hiddenCount > 0;

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      {hasAnchor && <PopoverAnchor virtualRef={anchorRef as RefObject<Element>} />}
      <PopoverTrigger asChild ref={triggerRef}>
        {hasBadges ? (
          <button
            type="button"
            className={SHOW_IF_CELL_CLASS.set}
            aria-label={t("workspace.surveys.edit.flow.edit_options_shown_if")}
            // The question list sits inside the block card: don't collapse it.
            onClick={(event) => event.stopPropagation()}>
            <OptionsShowIfCounts showIfCount={showIfCount} hiddenCount={hiddenCount} />
          </button>
        ) : (
          (newTrigger ?? (
            <AddConditionCell
              aria-label={`${t("workspace.surveys.edit.flow.show_options_if")} ${t("workspace.surveys.edit.flow.add_show_if_condition")}`}
            />
          ))
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
          hideHeading={hideHeading}
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
  readonly hideHeading: boolean;
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

/**
 * The popover's content, mounted only while it is open. It edits a draft of the survey: only Done
 * writes the options' show-ifs and Hidden flags back, so Escape, a click outside or Cancel changes
 * nothing (ENG-6969 T1).
 */
function OptionsShowIfEditor({
  localSurvey: savedSurvey,
  setLocalSurvey: setSavedSurvey,
  blockIdx,
  elementIdx,
  optionLists,
  hideHeading,
  onClose,
}: OptionsShowIfEditorProps) {
  const { t } = useTranslation();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const boundary = useContext(ShowIfPopoverBoundary);
  const [localSurvey, setLocalSurvey] = useState(savedSurvey);
  const element = localSurvey.blocks[blockIdx]?.elements[elementIdx];

  // An option's show-if sees what its question's sees.
  const { scope, getDefaultOperator } = useShowIfScope(localSurvey, {
    type: "element",
    blockIdx,
    elementIdx,
  });

  if (!element) return null;

  const addCondition = (target: TOptionTarget, key: string) => {
    if (!canAddShowIf(localSurvey, target)) return;
    // Its first field is still to be chosen (ENG-6969 T6): it lives in this draft only, and Done stays
    // disabled until it is picked.
    const showIf = createDraftShowIf();
    setLocalSurvey((survey) => updateShowIf(survey, target, () => showIf));
    setEditingKey(key);
  };

  const removeCondition = (target: TOptionTarget) => {
    setLocalSurvey((survey) => updateShowIf(survey, target, () => undefined));
    setEditingKey(null);
  };

  // Every option's condition has what its operator needs, so Done can save them all.
  const isDraftComplete = optionLists.every((listKey) =>
    getOptionList<TEditableOption>(element, listKey).every((item) => {
      const showIf = getShowIf(localSurvey, {
        type: "option",
        blockIdx,
        elementIdx,
        listKey,
        optionId: item.id,
      });
      return !showIf || isShowIfComplete(showIf);
    })
  );

  return (
    <ShowIfPopoverFrame
      // Named like the column that opens it (ENG-6969 T9).
      title={t("workspace.surveys.edit.flow.show_options_if")}
      help={t("workspace.surveys.edit.flow.options_shown_if_help")}
      hideHeading={hideHeading}
      info={{
        label: t("workspace.surveys.edit.flow.options_shown_if_info_label"),
        content: t("workspace.surveys.edit.flow.options_shown_if_info"),
      }}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isDraftComplete}
            onClick={() => {
              setSavedSurvey((survey) =>
                applyOptionsShowIfDraft(survey, localSurvey, blockIdx, elementIdx, optionLists)
              );
              onClose();
            }}>
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
              {/* One table per list: Option · Shown when · Hidden ⓘ, the (i) once in the header
                  (ENG-6969 T11). The rows share its columns through a subgrid. */}
              <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_auto] rounded-md border border-slate-200">
                <div className={OPTION_TABLE_HEADER_CLASS}>
                  {t("workspace.surveys.edit.flow.option_column")}
                </div>
                <div className={OPTION_TABLE_HEADER_CLASS}>{t("workspace.surveys.edit.flow.shown_when")}</div>
                <div className={cn(OPTION_TABLE_HEADER_CLASS, "justify-end")}>
                  {t("workspace.surveys.edit.flow.hide_option")}
                  {/* Below, toward the table's edge: above, it would cover the popover's heading. */}
                  <InfoTooltip
                    label={t("workspace.surveys.edit.flow.hidden_option_info_label")}
                    side="bottom"
                    align="end"
                    collisionBoundary={boundary}>
                    {t("workspace.surveys.edit.flow.hidden_option_help")}
                  </InfoTooltip>
                </div>
                <ul className="col-span-3 grid grid-cols-subgrid divide-y divide-slate-100">
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
              </div>
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
 * One option as a row of the table (ENG-6969 T11): its label, when it is shown ("Always", "If …", or
 * "Never shown" while Hidden) and its Hidden toggle. A Hidden option's row is muted and badged. A
 * click anywhere on the row opens its condition, or adds one when it has none; "Add condition" shows
 * on hover and on keyboard focus. The toggle keeps its clicks to itself.
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
  const elementIcons = useElementIcons();
  const isHidden = item.hidden === true;
  const showIf: TConditionGroup | undefined = item.showIf;
  const switchId = `option-hidden-${item.id}`;
  // A Hidden option without a condition offers none to add: Hidden wins over any condition.
  const addOnClick = isHidden ? undefined : onAddCondition;
  const onRowClick = showIf ? onToggleEditing : addOnClick;

  let shownWhen: ReactNode;
  if (isHidden) {
    shownWhen = <span className="text-slate-400">{t("workspace.surveys.edit.flow.never_shown")}</span>;
  } else if (showIf && !isShowIfComplete(showIf)) {
    // A condition being drafted: its field still to be chosen (ENG-6969 T6), or its value. No sentence yet.
    shownWhen = (
      <button
        type="button"
        className="min-w-0 truncate rounded-sm text-left text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
        aria-expanded={isEditing}
        onClick={(event) => {
          event.stopPropagation();
          onToggleEditing();
        }}>
        {hasUnchosenField(showIf)
          ? t("workspace.surveys.edit.flow.choose_question_or_field")
          : t("workspace.surveys.edit.flow.condition_incomplete")}
      </button>
    );
  } else if (showIf) {
    // References as chips (ENG-6969 T3); the button's name is the plain sentence (guardrail 4).
    const shownWhenParts = describeIfConditionParts(showIf, localSurvey, t, {
      locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
    });
    shownWhen = (
      <button
        type="button"
        aria-label={toPlainText(shownWhenParts)}
        className="min-w-0 truncate rounded-sm text-left text-slate-700 underline-offset-2 hover:underline focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
        aria-expanded={isEditing}
        onClick={(event) => {
          event.stopPropagation();
          onToggleEditing();
        }}>
        <FlowTextParts parts={shownWhenParts} elementIcons={elementIcons} />
      </button>
    );
  } else {
    shownWhen = (
      <>
        <span className={cn("text-slate-400", onAddCondition && "group-hover/option:hidden")}>
          {t("workspace.surveys.edit.flow.always_shown")}
        </span>
        {onAddCondition && (
          <button
            type="button"
            // Out of sight until the row is hovered, yet still reachable by keyboard (sr-only keeps
            // it in the tab order) and shown once focused.
            className="sr-only inline-flex items-center gap-1 rounded-sm font-medium text-slate-600 group-hover/option:not-sr-only focus-visible:not-sr-only focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden [&_svg]:size-3"
            onClick={(event) => {
              event.stopPropagation();
              onAddCondition();
            }}>
            <PlusIcon aria-hidden="true" />
            {t("workspace.surveys.edit.flow.add_show_if_condition")}
          </button>
        )}
      </>
    );
  }

  return (
    <li className="group/option col-span-3 grid grid-cols-subgrid">
      {/* The row is a mouse shortcut for the "If …" and "Add condition" buttons inside it, which
          keyboard users reach on their own. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- see above */}
      <div
        className={cn(
          "col-span-3 grid min-h-10 grid-cols-subgrid items-center text-sm",
          onRowClick && "cursor-pointer hover:bg-slate-50"
        )}
        onClick={onRowClick}>
        <div className="flex min-w-0 items-center gap-1.5 px-3 py-2">
          <span className={cn("truncate font-medium", isHidden ? "text-slate-400" : "text-slate-800")}>
            {label}
          </span>
          {isHidden && (
            <Badge
              type="gray"
              size="tiny"
              icon={<EyeOffIcon />}
              text={t("workspace.surveys.edit.flow.hidden_badge")}
              className="shrink-0"
            />
          )}
        </div>
        <div className="flex min-w-0 items-center px-3 py-2 text-xs">{shownWhen}</div>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only keeps the row's mouse shortcut off the toggle */}
        <div className="flex justify-end px-3 py-2" onClick={(event) => event.stopPropagation()}>
          <Switch
            id={switchId}
            checked={isHidden}
            onCheckedChange={onHiddenChange}
            aria-label={t("workspace.surveys.edit.flow.hide_option_named", { option: label })}
          />
        </div>
      </div>
      {isEditing && <div className="col-span-3 px-3 pb-2">{conditionsEditor}</div>}
    </li>
  );
}
