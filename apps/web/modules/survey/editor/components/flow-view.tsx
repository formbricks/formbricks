"use client";

import { ArrowRightIcon, EyeIcon, PlusIcon, Rows3Icon, SquareArrowRightExitIcon } from "lucide-react";
import { type Dispatch, type RefObject, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { LogicEditor } from "@/modules/survey/editor/components/logic-editor";
import {
  OptionsShowIfCounts,
  OptionsShowIfPopover,
} from "@/modules/survey/editor/components/options-show-if-popover";
import { FlowTextParts } from "@/modules/survey/editor/components/reference-chip";
import { RuleRowActions } from "@/modules/survey/editor/components/rule-row-actions";
import { ShowIfPopover } from "@/modules/survey/editor/components/show-if-popover";
import {
  AddConditionCell,
  SHOW_IF_CELL_CLASS,
  ShowIfPopoverBoundary,
} from "@/modules/survey/editor/components/show-if-popover-parts";
import { isAutoBlockName } from "@/modules/survey/editor/lib/blocks";
import {
  expandBlock,
  getBlockToggle,
  getRuleToReveal,
  toggleBlock,
} from "@/modules/survey/editor/lib/flow-open-state";
import {
  type TFlowBlockSection,
  type TFlowRuleRow,
  type TFlowShowIfCell,
  buildFlowOutline,
  getElementShowIfCells,
} from "@/modules/survey/editor/lib/flow-outline";
import {
  type TFlowActionText,
  describeBlockCounts,
  describeBlockShowIfParts,
  describeConditionGroupParts,
  describeFirstStepParts,
  describeRuleConditionParts,
  describeRuleSummary,
  getActionPlainText,
  getEndingLabel,
  getHeadlineText,
  summarizeRuleActions,
} from "@/modules/survey/editor/lib/flow-outline-text";
import {
  START_SCOPE_BLOCK_IDX,
  type TNewRuleKind,
  createRule,
  duplicateRule,
  getDefaultStartCondition,
  moveRule,
  removeRule,
  setBlockLogicFallback,
  setBlockRules,
  setStartRules,
} from "@/modules/survey/editor/lib/rule-list";
import { RuleTypeIcon, RuleTypeTile, getRuleTypeLabel } from "@/modules/survey/editor/lib/rule-types";
import { type TShowIfTarget, canAddShowIf } from "@/modules/survey/editor/lib/show-if-editing";
import { TARGET_LIST_CLASS, getFallbackTargetGroups } from "@/modules/survey/editor/lib/target-options";
import {
  getActionVariableOptions,
  getDefaultOperatorForElement,
  scrollElementCardIntoView,
} from "@/modules/survey/editor/lib/utils";
import { isBlockLogicItemValid } from "@/modules/survey/editor/lib/validation";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";
import { getElementIconMap } from "@/modules/survey/lib/elements";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import {
  ENDING_TONE,
  FlowOutline,
  FlowOutlineChildren,
  FlowOutlineGroup,
  FlowOutlineNote,
  FlowOutlineRow,
  FlowOutlineSectionLabel,
} from "@/modules/ui/components/flow-outline";
import { InfoTooltip, TruncationTooltip } from "@/modules/ui/components/info-tooltip";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface FlowViewProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly invalidElements: string[] | null;
  readonly setInvalidElements: Dispatch<SetStateAction<string[] | null>>;
  /**
   * The blocks open on the Flow tab. Kept by the survey editor: this tab unmounts on every tab switch,
   * and coming back keeps what the person opened and closed. Empty at first: every block collapsed.
   */
  readonly expandedBlockIds: Set<string>;
  readonly setExpandedBlockIds: Dispatch<SetStateAction<Set<string>>>;
  /** The validation pass whose flagged rule was last opened; kept by the editor for the same reason. */
  readonly handledInvalidRef: RefObject<string[] | null>;
  /** Switches to the Questions tab with the Embedded Data card open, to add a Calculated field. */
  readonly onAddCalculatedField?: () => void;
}

/**
 * The faint "Show block if…" hint an open block shows on its header where a show-if can be added,
 * always visible rather than on hover only.
 */
const SHOW_IF_HINT_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden";

/** A column header of a block card's question table (ENG-6969 T10). */
const QUESTION_TABLE_HEADER_CLASS =
  "border-b border-slate-200 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-slate-400 uppercase";

/** What Add logic starts, in the rule types' order: before the first question, every type (ENG-6952). */
const START_RULE_KINDS: readonly TNewRuleKind[] = ["jump", "setValue", "markLowQuality"];
const BLOCK_RULE_KINDS: readonly TNewRuleKind[] = ["jump", "setValue", "markLowQuality"];

/** One icon for every ending, card or redirect, on its row and on a chip that jumps to it. */
const EndingIcon = ({ className }: { readonly className?: string }) => (
  <SquareArrowRightExitIcon className={className} aria-hidden="true" />
);

/**
 * The Flow tab (ENG-6929): the whole survey flow on one outline, built by `buildFlowOutline`, with
 * each rule edited in place by today's rule editor. It edits the same in-memory survey as the other
 * tabs and saves through the editor's save; there is no Flow-tab backend.
 */
export const FlowView = ({
  localSurvey,
  setLocalSurvey,
  invalidElements,
  setInvalidElements,
  expandedBlockIds,
  setExpandedBlockIds,
  handledInvalidRef,
  onAddCalculatedField,
}: FlowViewProps) => {
  const { t, i18n } = useTranslation();
  // Dates on the rows read in the viewer's language (P65).
  const textFormat = { locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US" };
  const outline = useMemo(() => buildFlowOutline(localSurvey), [localSurvey]);
  const elementIcons = useMemo(() => getElementIconMap(t), [t]);

  // The show-if popovers and the info tooltips stay inside the editor column rather than spill over
  // the preview or cover the editor's header.
  const [popoverBoundary, setPopoverBoundary] = useState<HTMLDivElement | null>(null);
  // One row's settings open at a time, as in the UI mock.
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const toggleRow = (rowId: string) => setOpenRowId((current) => (current === rowId ? null : rowId));
  // The show-if popover open, keyed by what carries it: `block:<id>`, `element:<id>` or `options:<id>`.
  const [openShowIfKey, setOpenShowIfKey] = useState<string | null>(null);
  // The block whose Add logic menu is open: a collapsed block's hover "Add logic" expands it and opens
  // the menu at the end of its rules (ENG-6969 T15).
  const [addLogicMenuBlockId, setAddLogicMenuBlockId] = useState<string | null>(null);
  // A collapsed block's hover "Add logic": the block just expanded, its Add logic button may sit far
  // below (a long block's questions come first), so scroll it into view, then open the menu there.
  const [pendingAddLogicBlockId, setPendingAddLogicBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingAddLogicBlockId === null) return;
    const trigger = document.getElementById(`flow-add-logic-${pendingAddLogicBlockId}`);
    if (!trigger) return;
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    trigger.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    const timer = globalThis.setTimeout(
      () => {
        setAddLogicMenuBlockId(pendingAddLogicBlockId);
        setPendingAddLogicBlockId(null);
      },
      reduceMotion ? 0 : 350
    );
    return () => globalThis.clearTimeout(timer);
  }, [pendingAddLogicBlockId, expandedBlockIds]);

  // A save or publish that flags a rule opens the rule its toast names, and its block, and scrolls
  // there. The pass handled last is kept by the editor, so coming back to the tab doesn't reopen it.
  useEffect(() => {
    const previous = handledInvalidRef.current;
    handledInvalidRef.current = invalidElements;
    const ruleRows = [...outline.start.rules, ...outline.blocks.flatMap((block) => block.rules)];
    const ruleId = getRuleToReveal(
      invalidElements,
      previous,
      ruleRows.map((row) => row.id)
    );
    const invalidRow = ruleRows.find((row) => row.id === ruleId);
    if (!invalidRow) return;
    setOpenRowId(invalidRow.id);
    if (invalidRow.owner.type === "block") {
      const blockId = invalidRow.owner.blockId;
      setExpandedBlockIds((current) => expandBlock(current, blockId));
    }
    // After the block has opened and the row is on the page.
    scrollElementCardIntoView(invalidRow.id, "start");
    // Re-run only for a new validation pass, not on every edit of the outline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidElements]);

  // Live-clear a flagged rule once it is fixed, as the Questions tab did. Never adds: a rule just
  // added and not filled in yet is flagged by the next save or publish, not while it is being written.
  useEffect(() => {
    if (!invalidElements?.length) return;
    const fixedIds = [
      ...(localSurvey.startLogic ?? []),
      ...localSurvey.blocks.flatMap((block) => block.logic ?? []),
    ]
      .filter((rule) => invalidElements.includes(rule.id) && isBlockLogicItemValid(rule))
      .map((rule) => rule.id);
    if (fixedIds.length > 0) {
      setInvalidElements((current) => (current ?? []).filter((id) => !fixedIds.includes(id)));
    }
  }, [localSurvey.startLogic, localSurvey.blocks, invalidElements, setInvalidElements]);

  const updateBlockRules = (blockIdx: number, rules: TSurveyBlockLogic[]) =>
    setLocalSurvey((survey) => setBlockRules(survey, blockIdx, rules));

  // The rules before the first question share the rule editor; their scope is START_SCOPE_BLOCK_IDX.
  const updateRules = (scopeBlockIdx: number, rules: TSurveyBlockLogic[]) =>
    scopeBlockIdx === START_SCOPE_BLOCK_IDX
      ? setLocalSurvey((survey) => setStartRules(survey, rules))
      : updateBlockRules(scopeBlockIdx, rules);

  const addStartRule = (kind: TNewRuleKind) => {
    const rule = createRule(kind, {
      condition: getDefaultStartCondition(localSurvey),
      variableId: String(getActionVariableOptions(localSurvey)[0]?.value ?? ""),
    });
    setLocalSurvey((survey) => setStartRules(survey, [...(survey.startLogic ?? []), rule]));
    setOpenRowId(rule.id);
  };

  const addRule = (block: TFlowBlockSection, kind: TNewRuleKind) => {
    const firstElement = localSurvey.blocks[block.blockIdx]?.elements[0];
    if (!firstElement) return;
    const rule = createRule(kind, {
      condition: {
        leftOperand: { type: "element", value: firstElement.id },
        operator: getDefaultOperatorForElement(firstElement, t),
      },
      variableId: String(getActionVariableOptions(localSurvey)[0]?.value ?? ""),
    });
    updateBlockRules(block.blockIdx, [...(localSurvey.blocks[block.blockIdx].logic ?? []), rule]);
    setExpandedBlockIds((current) => expandBlock(current, block.id));
    setOpenRowId(rule.id);
  };

  /**
   * Opens a block's or a question's show-if popover on a new draft (from Add logic). Nothing is written
   * to the survey until Done (ENG-6969 T1).
   */
  const addShowIf = (key: string) => setOpenShowIfKey(key);

  const blockToggle = getBlockToggle(outline.blocks, expandedBlockIds);

  const countText = [
    t("workspace.surveys.edit.flow.count_blocks", { count: outline.counts.blocks }),
    t("workspace.surveys.edit.flow.count_endings", { count: outline.counts.endings }),
  ].join(" · ");

  /**
   * Where a rule sends the respondent: an outline pill at the end of its row (ENG-6969 T4). Pink for
   * an ending, slate with the block icon for a block. It truncates last.
   */
  const renderJumpPill = (jump: Extract<TFlowActionText, { kind: "jump" }>) => {
    const isEnding = jump.target === "ending";
    return (
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 shrink items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
          isEnding ? ENDING_TONE.pill : "border-slate-300 bg-white text-slate-900"
        )}>
        {isEnding ? (
          <EndingIcon className="size-3 shrink-0" />
        ) : (
          <Rows3Icon className="size-3 shrink-0 text-slate-500" aria-hidden="true" />
        )}
        <span data-truncates className="truncate">
          {getActionPlainText(jump, t)}
        </span>
      </span>
    );
  };

  const renderRuleRow = (row: TFlowRuleRow, rules: TSurveyBlockLogic[], scopeBlockIdx: number) => {
    const isOpen = openRowId === row.id;
    const actions = summarizeRuleActions(row.rule.actions, localSurvey, t, textFormat);
    // The whole rule in words: the tooltip of a cut-off row, and the row's accessible name.
    const sentence = describeRuleSummary(row.rule, localSurvey, t, textFormat);
    const onRulesChange = (next: TSurveyBlockLogic[]) => updateRules(scopeBlockIdx, next);

    return (
      <FlowOutlineRow
        key={row.id}
        id={row.id}
        tone={row.type}
        icon={<RuleTypeIcon type={row.type} />}
        isInvalid={invalidElements?.includes(row.id) ?? false}
        readOnlyLabel={row.editable ? undefined : t("workspace.surveys.edit.flow.read_only")}
        onToggle={row.editable ? () => toggleRow(row.id) : undefined}
        ariaLabel={row.editable ? sentence : undefined}
        // The block cards' chevron: a rule row opens too. A read-only row doesn't, so it gets none.
        showChevron={row.editable}
        isOpen={isOpen}
        actions={
          row.editable ? (
            <RuleRowActions
              isFirst={row.ruleIdx === 0}
              isLast={row.ruleIdx === rules.length - 1}
              onMoveUp={() => onRulesChange(moveRule(rules, row.ruleIdx, row.ruleIdx - 1))}
              onMoveDown={() => onRulesChange(moveRule(rules, row.ruleIdx, row.ruleIdx + 1))}
              onDuplicate={() => onRulesChange(duplicateRule(rules, row.ruleIdx))}
              onDelete={() => {
                onRulesChange(removeRule(rules, row.ruleIdx));
                if (isOpen) setOpenRowId(null);
              }}
            />
          ) : undefined
        }
        details={
          row.editable ? (
            <LogicEditor
              localSurvey={localSurvey}
              rules={rules}
              ruleIdx={row.ruleIdx}
              onRulesChange={onRulesChange}
              scopeBlockIdx={scopeBlockIdx}
              onAddCalculatedField={onAddCalculatedField}
            />
          ) : null
        }>
        {/* One line (ENG-6969 T2): the condition gives way first, then the action. The first action
            reads in full and the others fold into "+N"; the destination is a trailing pill. */}
        <TruncationTooltip
          content={sentence}
          collisionBoundary={popoverBoundary}
          className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap">
          {/* Questions and fields as chips (ENG-6969 T3); the sentence above stays plain text. */}
          <span data-truncates className="min-w-12 shrink-[999] truncate text-sm text-slate-700">
            <FlowTextParts
              parts={describeRuleConditionParts(row.rule, localSurvey, t, textFormat)}
              elementIcons={elementIcons}
            />
          </span>
          {(actions.first || actions.jump) && (
            <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          )}
          {actions.first && (
            <span data-truncates className="min-w-0 truncate text-sm font-medium text-slate-900">
              <FlowTextParts
                parts={describeFirstStepParts(row.rule.actions, localSurvey, t, textFormat)}
                elementIcons={elementIcons}
              />
            </span>
          )}
          {actions.moreCount > 0 && (
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-500">
              +{actions.moreCount}
            </span>
          )}
          {actions.jump && renderJumpPill(actions.jump)}
        </TruncationTooltip>
      </FlowOutlineRow>
    );
  };

  /** A question's "Show question if…" cell: its condition, or "Add condition" (ENG-6969 T10). */
  const renderQuestionShowIfCell = (
    cell: TFlowShowIfCell,
    target: Extract<TShowIfTarget, { type: "element" }>,
    key: string
  ) => {
    if (cell.level !== "question" || cell.state === "none") return null;
    if (cell.state === "set" && !cell.editable) {
      return (
        <span className={SHOW_IF_CELL_CLASS.readOnly} title={t("workspace.surveys.edit.flow.read_only_hint")}>
          <EyeIcon aria-hidden="true" />
          <span className="truncate">
            <FlowTextParts
              parts={describeConditionGroupParts(cell.conditions, localSurvey, t, textFormat)}
              elementIcons={elementIcons}
            />
          </span>
        </span>
      );
    }
    return (
      <ShowIfPopover
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        target={target}
        isOpen={openShowIfKey === key}
        onOpenChange={(open) => setOpenShowIfKey(open ? key : null)}
        newTrigger={
          <AddConditionCell
            aria-label={`${t("workspace.surveys.edit.flow.show_question_if")} ${t("workspace.surveys.edit.flow.add_show_if_condition")}`}
          />
        }
      />
    );
  };

  /**
   * A question's "Show options if…" cell (ENG-6937, ENG-6969 T10): the counts or "Add condition",
   * opening the options popover; empty for a question without options. Counts a read-only option
   * show-if made read-only are shown, not opened.
   */
  const renderOptionsShowIfCell = (cell: TFlowShowIfCell, blockIdx: number, elementIdx: number) => {
    if (cell.level !== "options" || cell.state === "none") return null;
    const item = outline.blocks[blockIdx]?.elements[elementIdx];
    if (!item) return null;
    if (cell.state === "set" && !cell.editable) {
      return (
        <span className={SHOW_IF_CELL_CLASS.readOnly} title={t("workspace.surveys.edit.flow.read_only_hint")}>
          <OptionsShowIfCounts showIfCount={cell.showIfCount} hiddenCount={cell.hiddenCount} />
        </span>
      );
    }
    const key = `options:${item.id}`;
    return (
      <OptionsShowIfPopover
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        blockIdx={blockIdx}
        elementIdx={elementIdx}
        optionLists={item.optionLists}
        showIfCount={cell.state === "set" ? cell.showIfCount : 0}
        hiddenCount={cell.state === "set" ? cell.hiddenCount : 0}
        isOpen={openShowIfKey === key}
        onOpenChange={(open) => setOpenShowIfKey(open ? key : null)}
      />
    );
  };

  /**
   * A block's questions as a table (ENG-6969 T10): each question's type icon, text and code (the name
   * rules and expressions use), then its "Show question if…" and "Show options if…" cells, in that
   * order. The columns start after the longest question, so set conditions line up.
   */
  const renderQuestionTable = (block: TFlowBlockSection) => {
    const surveyBlock = localSurvey.blocks[block.blockIdx];
    return (
      <div className="grid grid-cols-[fit-content(24rem)_minmax(0,14rem)_minmax(0,10rem)] gap-x-5 pl-7">
        <div className={QUESTION_TABLE_HEADER_CLASS}>{t("workspace.surveys.edit.flow.question_column")}</div>
        <div className={QUESTION_TABLE_HEADER_CLASS}>{t("workspace.surveys.edit.flow.show_question_if")}</div>
        <div className={QUESTION_TABLE_HEADER_CLASS}>{t("workspace.surveys.edit.flow.show_options_if")}</div>
        <ul className="col-span-3 grid grid-cols-subgrid">
          {surveyBlock.elements.map((element, elementIdx) => {
            const item = block.elements[elementIdx];
            if (!item) return null;
            const target = { type: "element", blockIdx: block.blockIdx, elementIdx } as const;
            const [questionCell, optionsCell] = getElementShowIfCells(
              item,
              canAddShowIf(localSurvey, target)
            );
            return (
              <li
                key={element.id}
                className="col-span-3 grid min-h-8 grid-cols-subgrid items-center border-b border-slate-100 last:border-b-0">
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-700">
                  <span className="shrink-0 text-slate-400 [&>svg]:size-3.5" aria-hidden="true">
                    {elementIcons[element.type]}
                  </span>
                  <span className="truncate">
                    {getHeadlineText(element.headline, localSurvey) || getElementBadgeText(element)}
                  </span>
                  <span className="shrink-0 rounded-sm bg-slate-100 px-1 font-mono text-[11px] text-slate-500">
                    {getElementBadgeText(element)}
                  </span>
                </div>
                <div className="flex min-w-0">
                  {renderQuestionShowIfCell(questionCell, target, `element:${element.id}`)}
                </div>
                <div className="flex min-w-0">
                  {renderOptionsShowIfCell(optionsCell, block.blockIdx, elementIdx)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  /** A block's show-if on its header: the chip, a read-only chip, or the faint hint on an open block. */
  const renderBlockShowIf = (block: TFlowBlockSection, isExpanded: boolean, canAdd: boolean) => {
    const badge = block.badges.find((candidate) => candidate.kind === "showIf");
    const target: TShowIfTarget = { type: "block", blockIdx: block.blockIdx };
    const key = `block:${block.id}`;
    if (badge && !badge.editable) {
      return (
        // The editable chip's look, without its hover; references as chips (ENG-6969 T3).
        <span
          className="inline-flex min-w-0 cursor-default items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600"
          title={t("workspace.surveys.edit.flow.read_only_hint")}>
          <EyeIcon className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            <FlowTextParts
              parts={describeBlockShowIfParts(badge.conditions, localSurvey, t, textFormat)}
              elementIcons={elementIcons}
            />
          </span>
        </span>
      );
    }
    // An open block shows how to add its show-if; a collapsed one stays quiet.
    if (!badge && !(isExpanded && canAdd) && openShowIfKey !== key) return null;
    return (
      <ShowIfPopover
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        target={target}
        isOpen={openShowIfKey === key}
        onOpenChange={(open) => setOpenShowIfKey(open ? key : null)}
        newTrigger={
          <button
            type="button"
            className={SHOW_IF_HINT_CLASS}
            // The hint sits inside the block row: don't collapse it.
            onClick={(event) => event.stopPropagation()}>
            <EyeIcon className="size-3" aria-hidden="true" />
            {t("workspace.surveys.edit.flow.show_block_if")}
          </button>
        }
      />
    );
  };

  const renderAddLogicMenu = (block: TFlowBlockSection, blockShowIfBlocker: string | null) => (
    // Not modal: an open menu must not lock the page's scroll (it can open near the screen's edge).
    <DropdownMenu
      modal={false}
      open={addLogicMenuBlockId === block.id}
      onOpenChange={(open) => setAddLogicMenuBlockId(open ? block.id : null)}>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="secondary" id={`flow-add-logic-${block.id}`}>
          {t("workspace.surveys.edit.add_logic")}
          <PlusIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // Non-modal, so it doesn't lock the page's scroll; a focus change elsewhere must not close it.
        // A click outside and Escape still do.
        onFocusOutside={(event) => event.preventDefault()}>
        {BLOCK_RULE_KINDS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            icon={<RuleTypeTile type={kind} />}
            onClick={() => addRule(block, kind)}>
            {getRuleTypeLabel(kind, t)}
          </DropdownMenuItem>
        ))}
        {/* Greyed out, it says why on hover: the item itself takes no pointer events. */}
        <TooltipRenderer
          shouldRender={blockShowIfBlocker !== null}
          tooltipContent={blockShowIfBlocker}
          triggerClass="block">
          <DropdownMenuItem
            // A tile the size of the rule types' above, so its label lines up with theirs.
            icon={
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-500 text-white [&_svg]:size-3.5"
                aria-hidden="true">
                <EyeIcon />
              </span>
            }
            disabled={blockShowIfBlocker !== null}
            onClick={() => addShowIf(`block:${block.id}`)}>
            {t("workspace.surveys.edit.flow.show_block_if")}
          </DropdownMenuItem>
        </TooltipRenderer>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div ref={setPopoverBoundary} className="mt-12 w-full px-5 py-4">
      <ShowIfPopoverBoundary.Provider value={popoverBoundary}>
        <FlowOutline
          actions={
            <>
              {/* One toggle for the blocks, not the rule rows: "Expand" while any block is collapsed. */}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={outline.blocks.length === 0}
                onClick={() =>
                  setExpandedBlockIds(
                    blockToggle === "expand" ? new Set(outline.blocks.map((block) => block.id)) : new Set()
                  )
                }>
                {blockToggle === "expand"
                  ? t("workspace.surveys.edit.flow.expand")
                  : t("workspace.surveys.edit.flow.collapse")}
              </Button>
              {/* Below its icon, inside the editor column: above, it covered the editor's header
                  (ENG-6969 T12). */}
              <InfoTooltip
                label={t("workspace.surveys.edit.flow.about_flow_tab")}
                side="bottom"
                align="start"
                collisionBoundary={popoverBoundary}>
                {t("workspace.surveys.edit.flow.hint")}
              </InfoTooltip>
            </>
          }
          count={countText}>
          <FlowOutlineSectionLabel>
            {t("workspace.surveys.edit.flow.before_first_question")}
          </FlowOutlineSectionLabel>
          <FlowOutlineChildren>
            {outline.start.rules.map((row) =>
              renderRuleRow(row, localSurvey.startLogic ?? [], START_SCOPE_BLOCK_IDX)
            )}
            <div className="flex items-center gap-1.5">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="secondary" id="flow-add-logic-start">
                    {t("workspace.surveys.edit.flow.add_logic_before_first_question")}
                    <PlusIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  // Non-modal, so it doesn't lock the page's scroll; a focus change elsewhere must not close it.
                  // A click outside and Escape still do.
                  onFocusOutside={(event) => event.preventDefault()}>
                  {START_RULE_KINDS.map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      icon={<RuleTypeTile type={kind} />}
                      onClick={() => addStartRule(kind)}>
                      {getRuleTypeLabel(kind, t)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <InfoTooltip
                label={t("workspace.surveys.edit.flow.about_before_first_question")}
                collisionBoundary={popoverBoundary}>
                {t("workspace.surveys.edit.flow.before_first_question_hint")}
              </InfoTooltip>
            </div>
          </FlowOutlineChildren>

          {outline.blocks.map((block) => {
            const surveyBlock = localSurvey.blocks[block.blockIdx];
            const isExpanded = expandedBlockIds.has(block.id);
            const rules = surveyBlock.logic ?? [];
            const onToggleBlock = () => setExpandedBlockIds((current) => toggleBlock(current, block.id));
            const canAddBlockShowIf = canAddShowIf(localSurvey, { type: "block", blockIdx: block.blockIdx });
            // Why the block can't get a show-if now, or null when it can.
            let blockShowIfBlocker: string | null = null;
            if (surveyBlock.showIf) {
              blockShowIfBlocker = t("workspace.surveys.edit.flow.show_block_if_exists");
            } else if (!canAddBlockShowIf) {
              blockShowIfBlocker = t("workspace.surveys.edit.flow.show_block_if_nothing_before");
            }
            const isNamed = surveyBlock.name.trim() !== "" && !isAutoBlockName(surveyBlock.name);

            return (
              <FlowOutlineGroup key={block.id}>
                <FlowOutlineRow
                  id={`flow-${block.id}`}
                  tone="block"
                  icon={<Rows3Icon />}
                  showChevron
                  isOpen={isExpanded}
                  onToggle={onToggleBlock}
                  // A collapsed block hides its rules: it shows when one of them is flagged.
                  isInvalid={
                    (invalidElements?.includes(block.id) ?? false) ||
                    (!isExpanded && block.rules.some((row) => invalidElements?.includes(row.id)))
                  }
                  body={isExpanded ? renderQuestionTable(block) : null}>
                  <span className="shrink-0 text-xs font-medium text-slate-500">
                    {t("workspace.surveys.edit.block_n", { blockNumber: block.blockIdx + 1 })}
                  </span>
                  {/* An unnamed block reads "Untitled", so its header isn't just a number (T15). */}
                  {isNamed ? (
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {surveyBlock.name}
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm font-medium text-slate-400">
                      {t("workspace.surveys.edit.flow.untitled_block")}
                    </span>
                  )}
                  {renderBlockShowIf(block, isExpanded, blockShowIfBlocker === null)}
                  <span className="ml-auto shrink-0 text-xs text-slate-500">
                    {describeBlockCounts(block, t)}
                  </span>
                  {/* A collapsed block offers Add logic on hover: it opens the block and its menu (T15). */}
                  {!isExpanded && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedBlockIds((current) => expandBlock(current, block.id));
                        setPendingAddLogicBlockId(block.id);
                      }}>
                      {t("workspace.surveys.edit.add_logic")}
                      <PlusIcon />
                    </Button>
                  )}
                </FlowOutlineRow>

                {isExpanded && (
                  <FlowOutlineChildren>
                    {block.rules.map((row) => renderRuleRow(row, rules, block.blockIdx))}

                    {/* Rules, then Add logic for the next one, then where everyone else goes: the
                        order the block runs in (ENG-6969 T7). */}
                    <div>{renderAddLogicMenu(block, blockShowIfBlocker)}</div>

                    {block.fallback && (
                      <FlowOutlineNote icon={<ArrowRightIcon aria-hidden="true" />}>
                        <span id={`flow-fallback-label-${block.id}`} className="shrink-0">
                          {t("workspace.surveys.edit.flow.otherwise_go_to")}
                        </span>
                        <InputCombobox
                          id={`flow-fallback-${block.id}`}
                          aria-labelledby={`flow-fallback-label-${block.id}`}
                          showSearch={true}
                          searchPlaceholder={t("workspace.surveys.edit.flow.search_blocks_and_endings")}
                          // The jump target's grouped list (ENG-6969 T6.6), with the destination's icon.
                          groupedOptions={getFallbackTargetGroups(localSurvey, block.blockIdx, t)}
                          iconClassName="size-4 text-slate-500"
                          dropdownClassName={TARGET_LIST_CLASS}
                          value={surveyBlock.logicFallback ?? "defaultSelection"}
                          onChangeValue={(value) =>
                            setLocalSurvey((survey) =>
                              setBlockLogicFallback(
                                survey,
                                block.blockIdx,
                                value === "defaultSelection" ? undefined : String(value)
                              )
                            )
                          }
                          comboboxClasses="h-7 w-fit min-w-40 bg-white"
                        />
                      </FlowOutlineNote>
                    )}
                  </FlowOutlineChildren>
                )}
              </FlowOutlineGroup>
            );
          })}

          {outline.endings.length > 0 && (
            <FlowOutlineSectionLabel>
              {t("workspace.surveys.edit.flow.endings_count", { count: outline.endings.length })}
            </FlowOutlineSectionLabel>
          )}
          {outline.endings.map((row) => {
            const ending = localSurvey.endings[row.endingIdx];
            const label = getEndingLabel(ending, localSurvey, t);
            // An ending is edited on the Questions tab; here it only shows where the flow ends. White
            // like a block card, with the pink tile, and no "End:" prefix under "Endings" (T14).
            return (
              <FlowOutlineRow
                key={row.id}
                id={`flow-${row.id}`}
                tone="ending"
                icon={<EndingIcon />}
                isInvalid={invalidElements?.includes(row.id) ?? false}>
                <span className={cn("min-w-0 truncate text-sm font-semibold", ENDING_TONE.title)}>
                  {label}
                </span>
                {row.url && row.url !== label && (
                  <span className={cn("min-w-0 truncate text-xs", ENDING_TONE.detail)}>→ {row.url}</span>
                )}
              </FlowOutlineRow>
            );
          })}
        </FlowOutline>
      </ShowIfPopoverBoundary.Provider>
    </div>
  );
};
