import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import type { TOptionListKey } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { buildFlowOutline, getElementShowIfCells } from "@/modules/survey/editor/lib/flow-outline";
import { canAddShowIf } from "@/modules/survey/editor/lib/show-if-editing";

/**
 * The show-if sections of the Questions tab (ENG-6949): "Show block if…" on a block's Settings tab, and
 * "Show question if…" and "Show options if…" on a question's. They read the survey through the Flow
 * tab's outline, so both tabs agree on what is set, what can be edited and what can be added.
 *
 * - `set`: there is a show-if to show; `editable: false` when the conditions editor can't show it
 * - `add`: none yet, and something earlier can be referenced
 * - `unavailable`: none yet, and nothing earlier can be referenced (`canAddShowIf`)
 */
export type TShowIfSection =
  | { state: "set"; conditions: TConditionGroup; editable: boolean }
  | { state: "add" }
  | { state: "unavailable" };

/** The "Show options if…" section, with the lists its popover edits. */
export type TOptionsShowIfSection =
  | {
      state: "set";
      showIfCount: number;
      hiddenCount: number;
      editable: boolean;
      optionLists: TOptionListKey[];
    }
  | { state: "add" | "unavailable"; optionLists: TOptionListKey[] };

const UNAVAILABLE: TShowIfSection = { state: "unavailable" };

export const getBlockShowIfSection = (survey: TSurvey, blockIdx: number): TShowIfSection => {
  const block = buildFlowOutline(survey).blocks[blockIdx];
  if (!block) return UNAVAILABLE;
  const badge = block.badges.find((candidate) => candidate.kind === "showIf");
  if (badge?.kind === "showIf") {
    return { state: "set", conditions: badge.conditions, editable: badge.editable };
  }
  return canAddShowIf(survey, { type: "block", blockIdx }) ? { state: "add" } : UNAVAILABLE;
};

/**
 * A question's two sections. `options` is null for a question without options (single and multi
 * select, ranking, picture selection and matrix have them, P2). Options already conditional or
 * Hidden stay editable even when nothing earlier can be referenced, so they can be changed back.
 */
export const getQuestionShowIfSections = (
  survey: TSurvey,
  blockIdx: number,
  elementIdx: number
): { question: TShowIfSection; options: TOptionsShowIfSection | null } => {
  const item = buildFlowOutline(survey).blocks[blockIdx]?.elements[elementIdx];
  if (!item) return { question: UNAVAILABLE, options: null };

  const canAdd = canAddShowIf(survey, { type: "element", blockIdx, elementIdx });
  const [questionCell, optionsCell] = getElementShowIfCells(item, canAdd);

  let question: TShowIfSection = canAdd ? { state: "add" } : UNAVAILABLE;
  if (questionCell.level === "question" && questionCell.state === "set") {
    question = { state: "set", conditions: questionCell.conditions, editable: questionCell.editable };
  }

  const { optionLists } = item;
  let options: TOptionsShowIfSection | null = null;
  if (optionsCell.level === "options" && optionsCell.state === "set") {
    options = {
      state: "set",
      showIfCount: optionsCell.showIfCount,
      hiddenCount: optionsCell.hiddenCount,
      editable: optionsCell.editable,
      optionLists,
    };
  } else if (optionLists.length > 0) {
    options = { state: canAdd ? "add" : "unavailable", optionLists };
  }

  return { question, options };
};
