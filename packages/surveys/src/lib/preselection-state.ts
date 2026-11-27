import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TPreselections } from "@formbricks/types/surveys/preselect-answer";
import { getBlockPreselection } from "@/lib/prefill";

/**
 * What the survey keeps about Pre-select answer actions (ENG-7437) while the respondent moves through
 * it, so Back undoes a pre-selection with the submit that made it.
 *
 * - `pending`: pre-selections no page has opened with yet, by question id.
 * - `applied`: answers a page opened with that the respondent has not submitted yet, as they were
 *   applied. Submitting the page makes them the respondent's own.
 * - `steps`: one entry per submit, next to the survey's `history`: what `pending` was before it, which
 *   questions it pre-selected (`added`), and which pre-selections the page it led to opened with
 *   (`opened`), from this submit or an earlier one.
 *
 * Plain JSON, so offline progress can store it as it is.
 */
export interface TPreselectionState {
  pending: TPreselections;
  applied: TResponseData;
  steps: { pending: TPreselections; added: string[]; opened: string[] }[];
}

export const createPreselectionState = (pending: TPreselections = {}): TPreselectionState => ({
  pending,
  applied: {},
  steps: [],
});

/**
 * A page was submitted: its answers are the respondent's from now on, and the rules that ran on the
 * way pre-selected `preselections`. Adds a step, so Back can undo exactly this.
 */
export const recordSubmit = (
  state: TPreselectionState,
  submittedElementIds: readonly string[],
  preselections: TPreselections
): TPreselectionState => {
  const applied = { ...state.applied };
  for (const elementId of submittedElementIds) delete applied[elementId];
  return {
    pending: { ...state.pending, ...preselections },
    applied,
    steps: [...state.steps, { pending: state.pending, added: Object.keys(preselections), opened: [] }],
  };
};

/**
 * Pre-selections that arrive without a submit, from blocks passed over when the survey opened
 * (`enterBlock`). There is no step to undo them with, as there is no page to go Back to.
 */
export const addPreselections = (
  state: TPreselectionState,
  preselections: TPreselections
): TPreselectionState => ({ ...state, pending: { ...state.pending, ...preselections } });

/**
 * A page opens: the answers it opens with (`getBlockPreselection`: only questions without an answer),
 * and the state with those pre-selections used up and remembered as applied.
 */
export const openPage = (
  state: TPreselectionState,
  block: Pick<TSurveyBlock, "elements">,
  answers: TResponseData,
  languageId: string
): { data: TResponseData; state: TPreselectionState } => {
  const onPage = block.elements.filter((element) => Object.hasOwn(state.pending, element.id));
  if (onPage.length === 0) return { data: {}, state };

  const data = getBlockPreselection(block, state.pending, answers, languageId);
  const pending = { ...state.pending };
  for (const element of onPage) delete pending[element.id];
  // The page belongs to the last submit: Back past it undoes what it opened with too.
  const steps = state.steps.map((step, idx) =>
    idx === state.steps.length - 1 ? { ...step, opened: [...step.opened, ...Object.keys(data)] } : step
  );
  return { data, state: { pending, applied: { ...state.applied, ...data }, steps } };
};

const isSameAnswer = (a: TResponseDataValue | undefined, b: TResponseDataValue | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Back undoes the last submit: `pending` returns to what it was before it, and an answer it
 * pre-selected, or that the page it led to opened with, loses that answer again when the respondent
 * has neither submitted nor changed it (`dropElementIds`). If
 * they then answer differently and the rule no longer matches, nothing is pre-selected; if it still
 * matches, the page opens with it again. An answer the respondent changed stays theirs.
 */
export const undoSubmit = (
  state: TPreselectionState,
  answers: TResponseData
): { state: TPreselectionState; dropElementIds: string[] } => {
  const step = state.steps.at(-1);
  if (!step) return { state, dropElementIds: [] };

  const applied = { ...state.applied };
  const dropElementIds = [...new Set([...step.added, ...step.opened])].filter(
    (elementId) => Object.hasOwn(applied, elementId) && isSameAnswer(answers[elementId], applied[elementId])
  );
  for (const elementId of dropElementIds) delete applied[elementId];
  return { state: { pending: step.pending, applied, steps: state.steps.slice(0, -1) }, dropElementIds };
};
