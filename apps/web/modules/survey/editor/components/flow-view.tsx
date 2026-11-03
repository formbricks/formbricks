"use client";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BinaryIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  LayersIcon,
  PlusIcon,
  Rows3Icon,
  SplitIcon,
  TrashIcon,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurvey } from "@formbricks/types/surveys/types";
import { LogicEditor } from "@/modules/survey/editor/components/logic-editor";
import { ShowIfPopover } from "@/modules/survey/editor/components/show-if-popover";
import { getBlockDisplayName, isAutoBlockName } from "@/modules/survey/editor/lib/blocks";
import {
  type TFlowBadge,
  type TFlowBlockSection,
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
import { InputCombobox } from "@/modules/ui/components/input-combo-box";

interface FlowViewProps {
  readonly localSurvey: TSurvey;
  readonly setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  readonly invalidElements: string[] | null;
  readonly setInvalidElements: Dispatch<SetStateAction<string[] | null>>;
  /** Switches to the Questions tab with this question or ending open. */
  readonly onEditOnQuestionsTab: (id: string) => void;
}

const RULE_ICON = { rule: <SplitIcon />, embeddedData: <BinaryIcon /> };

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
}: FlowViewProps) => {
  const { t } = useTranslation();
  const outline = useMemo(() => buildFlowOutline(localSurvey), [localSurvey]);

  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set());
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
    setCollapsedBlockIds((current) => {
      if (!current.has(blockId)) return current;
      const next = new Set(current);
      next.delete(blockId);
      return next;
    });
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
    setCollapsedBlockIds((current) => {
      const next = new Set(current);
      next.delete(block.id);
      return next;
    });
    setOpenRowId(rule.id);
  };

  /** Adds a show-if to a block or a question, starting from the nearest question it may use, and opens it. */
  const addShowIf = (target: TShowIfTarget, key: string) => {
    const showIf = createShowIf(localSurvey, target, (element) => getDefaultOperatorForElement(element, t));
    if (!showIf) return;
    setLocalSurvey((survey) => updateShowIf(survey, target, () => showIf));
    setOpenShowIfKey(key);
  };

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
            <FlagIcon className="size-3" aria-hidden="true" />
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

  const renderBadge = (badge: TFlowBadge, key: string, target?: { showIf: TShowIfTarget; key: string }) => {
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
              conditions: describeConditionGroup(badge.conditions, localSurvey, t),
            })}
            title={t("workspace.surveys.edit.flow.read_only_hint")}
          />
        );
      case "optionsShowIf":
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

  const renderRuleRow = (row: TFlowRuleRow, rules: TSurveyBlockLogic[], scopeBlockIdx: number) => {
    const isOpen = openRowId === row.id;
    const steps = describeRuleActions(row.rule.actions, localSurvey, t);
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
        isOpen={isOpen}
        details={
          row.editable ? (
            <div className="flex flex-col gap-3">
              <LogicEditor
                localSurvey={localSurvey}
                rules={rules}
                ruleIdx={row.ruleIdx}
                onRulesChange={onRulesChange}
                scopeBlockIdx={scopeBlockIdx}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onRulesChange(duplicateRule(rules, row.ruleIdx))}>
                  <CopyIcon />
                  {t("common.duplicate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={row.ruleIdx === 0}
                  onClick={() => onRulesChange(moveRule(rules, row.ruleIdx, row.ruleIdx - 1))}>
                  <ArrowUpIcon />
                  {t("common.move_up")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={row.ruleIdx === rules.length - 1}
                  onClick={() => onRulesChange(moveRule(rules, row.ruleIdx, row.ruleIdx + 1))}>
                  <ArrowDownIcon />
                  {t("common.move_down")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onRulesChange(removeRule(rules, row.ruleIdx));
                    setOpenRowId(null);
                  }}>
                  <TrashIcon />
                  {t("common.remove")}
                </Button>
              </div>
            </div>
          ) : null
        }>
        <span className="text-sm text-slate-700">
          {t("workspace.surveys.edit.flow.if")} {describeConditionGroup(row.rule.conditions, localSurvey, t)}
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
    <div className="mt-12 w-full px-5 py-4">
      <FlowOutline
        actions={
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setCollapsedBlockIds(new Set(outline.blocks.map((block) => block.id)))}>
              {t("workspace.surveys.edit.flow.collapse_all")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setCollapsedBlockIds(new Set())}>
              {t("workspace.surveys.edit.flow.expand_all")}
            </Button>
          </>
        }
        hint={t("workspace.surveys.edit.flow.hint")}
        count={countText}>
        <FlowOutlineSectionLabel>
          {t("workspace.surveys.edit.flow.before_first_question")}
        </FlowOutlineSectionLabel>
        <FlowOutlineChildren>
          {outline.start.rules.length === 0 && (
            <p className="pl-6 text-xs text-slate-500">
              {t("workspace.surveys.edit.flow.before_first_question_hint")}
            </p>
          )}
          {outline.start.rules.map((row) =>
            renderRuleRow(row, localSurvey.startLogic ?? [], START_SCOPE_BLOCK_IDX)
          )}
          <div className="pl-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="secondary" id="flow-add-logic-start">
                  {t("workspace.surveys.edit.add_logic")}
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
                  icon={<BinaryIcon className="size-4" />}
                  onClick={() => addStartRule("calculate")}>
                  {t("workspace.surveys.edit.flow.calculation")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </FlowOutlineChildren>

        {outline.blocks.map((block) => {
          const surveyBlock = localSurvey.blocks[block.blockIdx];
          const isExpanded = !collapsedBlockIds.has(block.id);
          const rules = surveyBlock.logic ?? [];
          const toggleBlock = () =>
            setCollapsedBlockIds((current) => {
              const next = new Set(current);
              if (next.has(block.id)) next.delete(block.id);
              else next.add(block.id);
              return next;
            });

          return (
            <FlowOutlineGroup key={block.id}>
              <FlowOutlineRow
                id={`flow-${block.id}`}
                tone="block"
                icon={<Rows3Icon />}
                showChevron
                isOpen={isExpanded}
                onToggle={toggleBlock}
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
                              {getHeadlineText(element.headline, localSurvey) || getElementBadgeText(element)}
                            </span>
                            {block.elements[elementIdx]?.badges.map((badge, idx) =>
                              renderBadge(badge, `${element.id}-${idx}`, {
                                showIf: showIfTarget,
                                key: showIfKey,
                              })
                            )}
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
                        <Button type="button" size="sm" variant="secondary" id={`flow-add-logic-${block.id}`}>
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
                          icon={<BinaryIcon className="size-4" />}
                          onClick={() => addRule(block, "calculate")}>
                          {t("workspace.surveys.edit.flow.calculation")}
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
              icon={<FlagIcon />}
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
    </div>
  );
};
