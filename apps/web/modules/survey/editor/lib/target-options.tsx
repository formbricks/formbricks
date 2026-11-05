import type { TFunction } from "i18next";
import { ArrowDownIcon, type LucideProps, Rows3Icon, SquareArrowRightExitIcon } from "lucide-react";
import { forwardRef } from "react";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { getBlockDisplayName } from "@/modules/survey/editor/lib/blocks";
import { getEndingLabel } from "@/modules/survey/editor/lib/flow-outline-text";
import type { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";

/**
 * Where a rule's Jump to and a block's "Otherwise go to" may send respondents, as one grouped list
 * (ENG-6969 T6.6): "Next block · <name>" on its own line, then the numbered Blocks, then the Endings by
 * their full names. Each target shows the destination's icon, as the Flow tab's pills do: the block
 * icon, or the pink ending icon. Only the grouping and the labels are new; which targets are offered
 * is today's set (guardrail 3), and cycle validation still decides what is allowed.
 */

/** The Flow tab's ending icon in its pink, whatever colour the list gives the other icons. */
const EndingTargetIcon = forwardRef<SVGSVGElement, LucideProps>(function EndingTargetIcon(
  { className, ...props },
  ref
) {
  return <SquareArrowRightExitIcon ref={ref} {...props} className={cn(className, "text-pink-500")} />;
});

/** The open target list: about 300px, or the field's width when that is wider. */
export const TARGET_LIST_CLASS = "w-75 max-w-[calc(100vw-2rem)] min-w-(--radix-dropdown-menu-trigger-width)";

/** The value "Otherwise go to" stores as no fallback: the next block. */
const DEFAULT_FALLBACK = "defaultSelection";

const getNextBlockLabel = (survey: TSurvey, blockIdx: number, t: TFunction): string => {
  const nextBlock = survey.blocks[blockIdx + 1];
  return nextBlock
    ? t("workspace.surveys.edit.flow.next_block_named", {
        name: getBlockDisplayName(nextBlock, blockIdx + 1, t),
      })
    : t("workspace.surveys.edit.next_block");
};

/** Blocks from `fromIdx` on, numbered as the Flow tab numbers them. */
const getBlockOptions = (survey: TSurvey, fromIdx: number, t: TFunction): TComboboxOption[] =>
  survey.blocks.slice(fromIdx).map((block, offset) => ({
    leading: String(fromIdx + offset + 1),
    icon: Rows3Icon,
    label: getBlockDisplayName(block, fromIdx + offset, t),
    value: block.id,
  }));

const getEndingOptions = (survey: TSurvey, t: TFunction): TComboboxOption[] =>
  survey.endings.map((ending) => ({
    icon: EndingTargetIcon,
    label: getEndingLabel(ending, survey, t),
    value: ending.id,
  }));

const toGroups = (
  t: TFunction,
  next: TComboboxOption | undefined,
  blocks: TComboboxOption[],
  endings: TComboboxOption[]
): TComboboxGroupedOption[] =>
  [
    // No heading: Next block is a single entry above the groups.
    { label: "", value: "next", options: next ? [next] : [] },
    { label: t("workspace.surveys.edit.flow.target_blocks"), value: "blocks", options: blocks },
    { label: t("workspace.surveys.edit.flow.target_endings"), value: "endings", options: endings },
  ].filter((group) => group.options.length > 0);

/**
 * A Jump to action's targets from the block at `blockIdx` (`-1` before the first question): the next
 * block, the blocks after it, and every ending.
 */
export const getJumpTargetGroups = (
  survey: TSurvey,
  blockIdx: number,
  t: TFunction
): TComboboxGroupedOption[] => {
  const nextBlock = survey.blocks[blockIdx + 1];
  const next = nextBlock
    ? { icon: ArrowDownIcon, label: getNextBlockLabel(survey, blockIdx, t), value: nextBlock.id }
    : undefined;
  return toGroups(t, next, getBlockOptions(survey, blockIdx + 2, t), getEndingOptions(survey, t));
};

/**
 * A block's "Otherwise go to" targets: Next block (stored as no fallback), each later block, the next
 * one included as it is today, and every ending.
 */
export const getFallbackTargetGroups = (
  survey: TSurvey,
  blockIdx: number,
  t: TFunction
): TComboboxGroupedOption[] =>
  toGroups(
    t,
    { icon: ArrowDownIcon, label: getNextBlockLabel(survey, blockIdx, t), value: DEFAULT_FALLBACK },
    getBlockOptions(survey, blockIdx + 1, t),
    getEndingOptions(survey, t)
  );
