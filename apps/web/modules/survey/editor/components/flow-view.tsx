"use client";

import {
  ArrowRightIcon,
  BinaryIcon,
  EqualIcon,
  EyeIcon,
  EyeOffIcon,
  HandshakeIcon,
  LayersIcon,
  PlusIcon,
  Rows3Icon,
  ShieldAlertIcon,
  SplitIcon,
  Undo2Icon,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurvey, TSurveyEnding } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { LogicEditor } from "@/modules/survey/editor/components/logic-editor";
import { OptionsShowIfPopover } from "@/modules/survey/editor/components/options-show-if-popover";
import { RuleRowActions } from "@/modules/survey/editor/components/rule-row-actions";
import { ShowIfPopover } from "@/modules/survey/editor/components/show-if-popover";
import { ShowIfPopoverBoundary } from "@/modules/survey/editor/components/show-if-popover-parts";
import { getBlockDisplayName, isAutoBlockName } from "@/modules/survey/editor/lib/blocks";
import { expandBlock, getBlockToggle, toggleBlock } from "@/modules/survey/editor/lib/flow-open-state";
import {
  type TFlowBadge,
  type TFlowBlockSection,
  type TFlowElementItem,
  type TFlowRuleRow,
  buildFlowOutline,
} from "@/modules/survey/editor/lib/flow-outline";
import {
  type TFlowActionStep,
  describeConditionGroup,
  describeRuleActions,
  getEndingLabel,
  getHeadlineText,
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
import {
  type TShowIfTarget,
  canAddShowIf,
  createShowIf,
  updateShowIf,
} from "@/modules/survey/editor/lib/show-if-editing";
import { getActionVariableOptions, getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
import { isBlockLogicItemValid } from "@/modules/survey/editor/lib/validation";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import {
  FlowOutline,
  FlowOutlineChildren,
  FlowOutlineGroup,
  FlowOutlineNote,
  FlowOutlineRow,
  FlowOutlineSectionLabel,
} from "@/modules/ui/components/flow-outline";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";

interface FlowViewProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly invalidElements: string[] | null;
  readonly setInvalidElements: Dispatch<SetStateAction<string[] | null>>;
  /** Switches to the Questions tab with this question or ending open. */
  readonly onEditOnQuestionsTab: (id: string) => void;
  /** The saved survey, for the published lock: copying options keeps the options that existed at launch. */
  readonly persistedSurvey?: TSurvey;
  /**
   * The blocks open on the Flow tab. Kept by the survey editor: this tab unmounts on every tab switch,
   * and coming back keeps what the person opened and closed. Empty at first: every block collapsed.
   */
  readonly expandedBlockIds: Set<string>;
  readonly setExpandedBlockIds: Dispatch<SetStateAction<Set<string>>>;
}

const RULE_ICON = { rule: <SplitIcon />, embeddedData: <BinaryIcon /> };

/** The Questions tab's ending icons: a handshake for an ending card, a turned arrow for a redirect. */
const EndingTypeIcon = ({
  type,
  className,
}: {
  readonly type: TSurveyEnding["type"];
  readonly className?: string;
}) =>
  type === "redirectToUrl" ? (
    <Undo2Icon className={cn("rotate-180", className)} aria-hidden="true" />
  ) : (
    <HandshakeIcon className={className} aria-hidden="true" />
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
  onEditOnQuestionsTab,
  persistedSurvey,
  expandedBlockIds,
  setExpandedBlockIds,
}: FlowViewProps) => {
  const { t, i18n } = useTranslation();
  // Dates on the rows read in the viewer's language (P65).
  const textFormat = { locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US" };
  const outline = useMemo(() => buildFlowOutline(localSurvey), [localSurvey]);

  // The show-if popovers stay inside the editor column rather than spill over the preview.
  const [popoverBoundary, setPopoverBoundary] = useState<HTMLDivElement | null>(null);
  // One row's settings open at a time, as in the UI mock.
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const toggleRow = (rowId: string) => setOpenRowId((current) => (current === rowId ? null : rowId));
  // The show-if popover open, keyed by what carries it: `block:<id>` or `element:<id>` (ENG-6931).
  const [openShowIfKey, setOpenShowIfKey] = useState<string | null>(null);

  // A save or publish that flags a rule opens it and its block, so the problem is visible on its row.
  // Only newly flagged rules: a rule fixed and cleared below must not move the open row elsewhere.
  const previousInvalidRef = useRef<string[] | null>(null);
  useEffect(() => {
    const previous = previousInvalidRef.current ?? [];
    previousInvalidRef.current = invalidElements;
    if (!invalidElements?.length) return;
    const invalidRow = [...outline.start.rules, ...outline.blocks.flatMap((block) => block.rules)].find(
      (row) => invalidElements.includes(row.id) && !previous.includes(row.id)
    );
    if (!invalidRow) return;
    setOpenRowId(invalidRow.id);
    if (invalidRow.owner.type !== "block") return;
    const blockId = invalidRow.owner.blockId;
    setExpandedBlockIds((current) => expandBlock(current, blockId));
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

  /** Adds a show-if to a block or a question, starting from the nearest question it may use, and opens it. */
  const addShowIf = (target: TShowIfTarget, key: string) => {
    const showIf = createShowIf(localSurvey, target, (element) => getDefaultOperatorForElement(element, t));
    if (!showIf) return;
    setLocalSurvey((survey) => updateShowIf(survey, target, () => showIf));
    setOpenShowIfKey(key);
  };

  const blockToggle = getBlockToggle(outline.blocks, expandedBlockIds);

  const countText = [
    t("workspace.surveys.edit.flow.count_blocks", { count: outline.counts.blocks }),
    t("workspace.surveys.edit.flow.count_endings", { count: outline.counts.endings }),
  ].join(" · ");

  const renderActionTarget = ({ action }: TFlowActionStep, key: string) => {
    if (action.kind === "jump") {
      if (action.target === "ending") {
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            <EndingTypeIcon type={action.endingType} className="size-3" />
            {action.label}
          </span>
        );
      }
      // A destination reads as a destination, not as more text of the action before it.
      return (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-900">
          <Rows3Icon className="size-3 text-slate-500" aria-hidden="true" />
          {action.target === "block" ? action.label : t("workspace.surveys.edit.flow.no_destination")}
        </span>
      );
    }
    if (action.kind === "requireAnswer") {
      return (
        <span key={key} className="text-sm font-medium text-slate-900">
          {t("workspace.surveys.edit.flow.require_answer_to", { question: action.label })}
        </span>
      );
    }
    if (action.kind === "markLowQuality") {
      return (
        <span key={key} className="inline-flex items-center gap-1 text-sm font-medium text-slate-900">
          <ShieldAlertIcon className="size-4 text-amber-600" aria-hidden="true" />
          {t("workspace.surveys.edit.mark_as_low_quality")}
        </span>
      );
    }
    return (
      <span key={key} className="text-sm font-medium text-slate-900">
        {action.label}
      </span>
    );
  };

  /** One action of a rule, set apart from the one before it: "·" between steps, "then" before the jump. */
  const renderActionStep = (step: TFlowActionStep, key: string) => (
    <span key={key} className="inline-flex items-center gap-2">
      {step.lead === "and" && (
        <span className="text-slate-400" aria-hidden="true">
          ·
        </span>
      )}
      {step.lead === "then" && (
        <span className="text-xs text-slate-500">{t("workspace.surveys.edit.flow.then")}</span>
      )}
      {renderActionTarget(step, `${key}-target`)}
    </span>
  );

  /**
   * Whether a question gets the "Options shown if" popover (ENG-6937): it has option lists, and no
   * option show-if is read-only. Its option badges and its copied-options badge are drawn inside it.
   */
  const hasOptionsPopover = (item: TFlowElementItem | undefined): item is TFlowElementItem =>
    item !== undefined &&
    item.optionLists.length > 0 &&
    !item.badges.some(
      (badge) => (badge.kind === "optionsShowIf" || badge.kind === "hiddenOptions") && !badge.editable
    );

  const renderBadge = (
    badge: TFlowBadge,
    key: string,
    target?: { showIf: TShowIfTarget; key: string },
    item?: TFlowElementItem
  ) => {
    switch (badge.kind) {
      case "showIf":
        if (badge.editable && target) {
          return (
            <ShowIfPopover
              key={key}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              target={target.showIf}
              isOpen={openShowIfKey === target.key}
              onOpenChange={(open) => setOpenShowIfKey(open ? target.key : null)}
            />
          );
        }
        return (
          <Badge
            key={key}
            type="gray"
            size="tiny"
            icon={<EyeIcon />}
            text={t("workspace.surveys.edit.flow.show_if", {
              conditions: describeConditionGroup(badge.conditions, localSurvey, t, textFormat),
            })}
            title={t("workspace.surveys.edit.flow.read_only_hint")}
          />
        );
      case "optionsShowIf":
        // ENG-6937: editable ones open the question's "Options shown if" popover, rendered with it.
        if (badge.editable) return null;
        return (
          <Badge
            key={key}
            type="gray"
            size="tiny"
            icon={<EyeIcon />}
            text={t("workspace.surveys.edit.flow.options_show_if", { count: badge.count })}
            title={t("workspace.surveys.edit.flow.read_only_hint")}
          />
        );
      case "hiddenOptions":
        if (badge.editable) return null;
        return (
          <Badge
            key={key}
            type="gray"
            size="tiny"
            icon={<EyeOffIcon />}
            text={t("workspace.surveys.edit.flow.hidden_options", { count: badge.count })}
            title={t("workspace.surveys.edit.flow.read_only_hint")}
          />
        );
      case "optionsCopiedFrom": {
        // ENG-6938: an editable link opens the question's "Options shown if" popover, rendered with it.
        if (badge.editable && hasOptionsPopover(item)) return null;
        const source = localSurvey.blocks
          .flatMap((block) => block.elements)
          .find((element) => element.id === badge.sourceId);
        return (
          <Badge
            key={key}
            type="gray"
            size="tiny"
            icon={<LayersIcon />}
            text={t("workspace.surveys.edit.flow.options_copied_from", {
              question: source ? getElementBadgeText(source) : badge.sourceId,
            })}
            title={t("workspace.surveys.edit.flow.read_only_hint")}
          />
        );
      }
    }
  };

  /**
   * A question with options gets the "Options shown if" popover (ENG-6937), opened from its option
   * badges, or from a hover action when it has none. Badges a read-only option show-if made read-only
   * render as plain badges instead.
   */
  const renderOptionsShowIf = (item: TFlowElementItem | undefined, blockIdx: number) => {
    if (!hasOptionsPopover(item)) return null;
    const optionBadges = item.badges.filter(
      (badge) => badge.kind === "optionsShowIf" || badge.kind === "hiddenOptions"
    );
    const copiedFrom = item.badges.find((badge) => badge.kind === "optionsCopiedFrom");
    const countOf = (kind: "optionsShowIf" | "hiddenOptions") => {
      const badge = optionBadges.find((candidate) => candidate.kind === kind);
      return badge && "count" in badge ? badge.count : 0;
    };
    const key = `options:${item.id}`;
    return (
      <OptionsShowIfPopover
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        blockIdx={blockIdx}
        elementIdx={item.elementIdx}
        optionLists={item.optionLists}
        showIfCount={countOf("optionsShowIf")}
        hiddenCount={countOf("hiddenOptions")}
        copiedFromId={copiedFrom?.kind === "optionsCopiedFrom" ? copiedFrom.sourceId : undefined}
        persistedSurvey={persistedSurvey}
        isOpen={openShowIfKey === key}
        onOpenChange={(open) => setOpenShowIfKey(open ? key : null)}
      />
    );
  };

  const renderRuleRow = (row: TFlowRuleRow, rules: TSurveyBlockLogic[], scopeBlockIdx: number) => {
    const isOpen = openRowId === row.id;
    const steps = describeRuleActions(row.rule.actions, localSurvey, t, textFormat);
    const onRulesChange = (next: TSurveyBlockLogic[]) => updateRules(scopeBlockIdx, next);

    return (
      <FlowOutlineRow
        key={row.id}
        id={row.id}
        tone={row.tone}
        icon={RULE_ICON[row.tone]}
        isInvalid={invalidElements?.includes(row.id) ?? false}
        readOnlyLabel={row.editable ? undefined : t("workspace.surveys.edit.flow.read_only")}
        onToggle={row.editable ? () => toggleRow(row.id) : undefined}
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
            />
          ) : null
        }>
        <span className="text-sm text-slate-700">
          {row.rule.conditions.conditions.length === 0
            ? t("workspace.surveys.edit.flow.always_runs")
            : `${t("workspace.surveys.edit.flow.if")} ${describeConditionGroup(row.rule.conditions, localSurvey, t, textFormat)}`}
        </span>
        <ArrowRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        {steps.map((step, idx) => renderActionStep(step, `${row.id}-${idx}`))}
      </FlowOutlineRow>
    );
  };

  const getFallbackOptions = (blockIdx: number) => [
    { label: t("workspace.surveys.edit.next_block"), value: "defaultSelection" },
    ...localSurvey.blocks
      .slice(blockIdx + 1)
      .map((block, idx) => ({ label: getBlockDisplayName(block, blockIdx + 1 + idx, t), value: block.id })),
    ...localSurvey.endings.map((ending) => ({
      label: t("workspace.surveys.edit.flow.end_label", { label: getEndingLabel(ending, localSurvey, t) }),
      value: ending.id,
    })),
  ];

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
              <InfoTooltip label={t("workspace.surveys.edit.flow.about_flow_tab")}>
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
            <div className="flex items-center gap-1.5 pl-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="secondary" id="flow-add-logic-start">
                    {t("workspace.surveys.edit.flow.add_logic_before_first_question")}
                    <PlusIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    icon={<SplitIcon className="size-4" />}
                    onClick={() => addStartRule("jump")}>
                    {t("workspace.surveys.edit.flow.jump_rule")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    icon={<EqualIcon className="size-4" />}
                    onClick={() => addStartRule("setValue")}>
                    {t("workspace.surveys.edit.flow.set_value")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <InfoTooltip label={t("workspace.surveys.edit.flow.about_before_first_question")}>
                {t("workspace.surveys.edit.flow.before_first_question_hint")}
              </InfoTooltip>
            </div>
          </FlowOutlineChildren>

          {outline.blocks.map((block) => {
            const surveyBlock = localSurvey.blocks[block.blockIdx];
            const isExpanded = expandedBlockIds.has(block.id);
            const rules = surveyBlock.logic ?? [];
            const onToggleBlock = () => setExpandedBlockIds((current) => toggleBlock(current, block.id));

            return (
              <FlowOutlineGroup key={block.id}>
                <FlowOutlineRow
                  id={`flow-${block.id}`}
                  tone="block"
                  icon={<Rows3Icon />}
                  showChevron
                  isOpen={isExpanded}
                  onToggle={onToggleBlock}
                  isInvalid={invalidElements?.includes(block.id) ?? false}
                  body={
                    isExpanded ? (
                      <ul className="space-y-1.5 pl-10">
                        {surveyBlock.elements.map((element, elementIdx) => {
                          const showIfTarget: TShowIfTarget = {
                            type: "element",
                            blockIdx: block.blockIdx,
                            elementIdx,
                          };
                          const showIfKey = `element:${element.id}`;
                          return (
                            <li
                              key={element.id}
                              className="group flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span className="truncate">
                                {getHeadlineText(element.headline, localSurvey) ||
                                  getElementBadgeText(element)}
                              </span>
                              {block.elements[elementIdx]?.badges.map((badge, idx) =>
                                renderBadge(
                                  badge,
                                  `${element.id}-${idx}`,
                                  { showIf: showIfTarget, key: showIfKey },
                                  block.elements[elementIdx]
                                )
                              )}
                              {renderOptionsShowIf(block.elements[elementIdx], block.blockIdx)}
                              {!element.showIf && canAddShowIf(localSurvey, showIfTarget) && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
                                  onClick={(event) => {
                                    // The question list sits inside the block row: don't collapse it.
                                    event.stopPropagation();
                                    addShowIf(showIfTarget, showIfKey);
                                  }}>
                                  <EyeIcon className="size-3" aria-hidden="true" />
                                  {t("workspace.surveys.edit.flow.show_question_if")}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null
                  }>
                  <span className="text-xs font-medium text-slate-500">
                    {t("workspace.surveys.edit.block_n", { blockNumber: block.blockIdx + 1 })}
                  </span>
                  {surveyBlock.name.trim() && !isAutoBlockName(surveyBlock.name) && (
                    <span className="text-sm font-semibold text-slate-900">{surveyBlock.name}</span>
                  )}
                  {block.badges.map((badge, idx) =>
                    renderBadge(badge, `${block.id}-${idx}`, {
                      showIf: { type: "block", blockIdx: block.blockIdx },
                      key: `block:${block.id}`,
                    })
                  )}
                  <span className="ml-auto text-xs text-slate-500">
                    {[
                      t("common.count_questions", { count: block.elementCount }),
                      t("workspace.surveys.edit.flow.count_rules", { count: block.ruleCount }),
                    ].join(" · ")}
                  </span>
                </FlowOutlineRow>

                {isExpanded && (
                  <FlowOutlineChildren>
                    {block.rules.map((row) => renderRuleRow(row, rules, block.blockIdx))}

                    {block.fallback && (
                      <FlowOutlineNote icon={<ArrowRightIcon aria-hidden="true" />}>
                        <span className="inline-flex flex-wrap items-center gap-x-2">
                          <Trans
                            i18nKey="workspace.surveys.edit.all_other_answers_will_continue_to_fallback"
                            components={{
                              fallbackSelect: (
                                <InputCombobox
                                  id={`flow-fallback-${block.id}`}
                                  showSearch={true}
                                  options={getFallbackOptions(block.blockIdx)}
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
                                  comboboxClasses="w-fit min-w-40 bg-white"
                                />
                              ),
                            }}
                          />
                        </span>
                      </FlowOutlineNote>
                    )}

                    <div className="pl-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            id={`flow-add-logic-${block.id}`}>
                            {t("workspace.surveys.edit.add_logic")}
                            <PlusIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            icon={<SplitIcon className="size-4" />}
                            onClick={() => addRule(block, "jump")}>
                            {t("workspace.surveys.edit.flow.jump_rule")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            icon={<EqualIcon className="size-4" />}
                            onClick={() => addRule(block, "setValue")}>
                            {t("workspace.surveys.edit.flow.set_value")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            icon={<ShieldAlertIcon className="size-4" />}
                            onClick={() => addRule(block, "markLowQuality")}>
                            {t("workspace.surveys.edit.mark_as_low_quality")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            icon={<EyeIcon className="size-4" />}
                            disabled={
                              Boolean(surveyBlock.showIf) ||
                              !canAddShowIf(localSurvey, { type: "block", blockIdx: block.blockIdx })
                            }
                            onClick={() =>
                              addShowIf({ type: "block", blockIdx: block.blockIdx }, `block:${block.id}`)
                            }>
                            {t("workspace.surveys.edit.flow.show_block_if")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </FlowOutlineChildren>
                )}
              </FlowOutlineGroup>
            );
          })}

          {outline.endings.length > 0 && (
            <FlowOutlineSectionLabel>{t("workspace.surveys.edit.flow.endings")}</FlowOutlineSectionLabel>
          )}
          {outline.endings.map((row) => {
            const ending = localSurvey.endings[row.endingIdx];
            const label = getEndingLabel(ending, localSurvey, t);
            const rowId = `ending-${row.id}`;
            return (
              <FlowOutlineRow
                key={row.id}
                id={`flow-${row.id}`}
                tone="ending"
                icon={<EndingTypeIcon type={ending.type} />}
                isInvalid={invalidElements?.includes(row.id) ?? false}
                onToggle={() => toggleRow(rowId)}
                isOpen={openRowId === rowId}
                details={
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
                    <span>
                      {row.type === "redirectToUrl"
                        ? t("workspace.surveys.edit.flow.ending_redirect", { url: row.url ?? "" })
                        : t("workspace.surveys.edit.flow.ending_card", { label })}
                      <span className="block text-xs text-slate-500">
                        {t("workspace.surveys.edit.flow.ending_edit_hint")}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onEditOnQuestionsTab(row.id)}>
                      {t("workspace.surveys.edit.flow.edit_on_questions_tab")}
                    </Button>
                  </div>
                }>
                <span className="text-sm font-semibold text-red-700">
                  {t("workspace.surveys.edit.flow.end_label", { label })}
                </span>
                {row.url && <span className="text-xs text-red-700/80">→ {row.url}</span>}
              </FlowOutlineRow>
            );
          })}
        </FlowOutline>
      </ShowIfPopoverBoundary.Provider>
    </div>
  );
};
