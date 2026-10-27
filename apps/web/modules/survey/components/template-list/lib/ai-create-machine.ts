import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { EMPTY_AI_DRAFT, type TAiDraftState, mergeAiDraftSnapshot } from "./ai-draft-reducer";

export type TAiCreateStatus = "idle" | "generating" | "review" | "creating";

/** What produced the draft on screen: a typed prompt (Create with AI) or a dropped file (Import). */
export type TAiCreateSourceKind = "prompt" | "file";

/** What the machine needs of a payload: blocks holding elements, to tell an empty draft from a real one. */
export interface TDraftPayload {
  blocks?: ReadonlyArray<{ elements?: ReadonlyArray<unknown> }>;
}

/**
 * `TReport` is what a source returns next to its payload: an import's report. Create with AI has none,
 * so it defaults to `never` and `report` stays `null`. `TPayload` is what the source's `done` carries
 * and its create takes: Create with AI's parsed body, or an import's draft document.
 */
export interface TAiCreateState<TReport = never, TPayload extends TDraftPayload = TV3CreateSurveyBody> {
  status: TAiCreateStatus;
  draft: TAiDraftState;
  /** The validated create payload. Only ever set from the stream's terminal event. */
  payload: TPayload | null;
  /** An error code, not a message, so the reducer stays free of `t`. */
  errorCode: string | null;
  /**
   * The source that produced what is on screen — the submitted prompt text, or the file name — not
   * the one in the input. Editing the prompt keeps the finished draft, so rendering the live text
   * would label an old draft with words that had no part in it, right where the user checks it
   * before saving. Display only.
   */
  sourceLabel: string;
  sourceKind: TAiCreateSourceKind;
  /**
   * An import produces a report next to the payload; Create with AI has none. Set by `DONE`, cleared
   * whenever a new run starts.
   */
  report: TReport | null;
  /**
   * The last finished draft, held aside while a regeneration runs. Regenerating is a gamble on a
   * better result: abandoning it, or having it fail, must not cost the one the user already had.
   */
  previous: {
    draft: TAiDraftState;
    payload: TPayload;
    sourceLabel: string;
    report: TReport | null;
  } | null;
}

export type TAiCreateAction<TReport = never, TPayload extends TDraftPayload = TV3CreateSurveyBody> =
  | { type: "SUBMIT"; sourceLabel: string; sourceKind?: TAiCreateSourceKind }
  | { type: "SNAPSHOT"; snapshot: TSurveyGenerationDraftSnapshot }
  | { type: "DONE"; payload: TPayload; report?: TReport | null }
  | { type: "STOP" }
  | { type: "FAIL"; errorCode: string }
  | { type: "CREATE_FAILED"; errorCode: string }
  | { type: "EDIT_PROMPT" }
  | { type: "BACK_TO_DRAFT" }
  | { type: "REGENERATE"; sourceLabel: string; sourceKind?: TAiCreateSourceKind }
  | { type: "CREATE" }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

export const INITIAL_AI_CREATE_STATE: TAiCreateState<never, never> = {
  status: "idle",
  draft: EMPTY_AI_DRAFT,
  payload: null,
  errorCode: null,
  sourceLabel: "",
  sourceKind: "prompt",
  report: null,
  previous: null,
};

/**
 * Whether the terminal payload actually carries a survey. The create body nests elements inside
 * blocks, so a payload can have blocks and still have nothing to answer.
 */
function isEmptyPayload(payload: TDraftPayload): boolean {
  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];

  return !blocks.some((block) => Array.isArray(block?.elements) && block.elements.length > 0);
}

/** Put a held-aside draft back on screen, or fall back to a clean slate when there is none. */
function restorePrevious<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>,
  errorCode: string | null = null
): TAiCreateState<TReport, TPayload> {
  if (!state.previous) {
    return { ...INITIAL_AI_CREATE_STATE, errorCode };
  }

  return {
    status: "review",
    draft: state.previous.draft,
    payload: state.previous.payload,
    errorCode,
    sourceLabel: state.previous.sourceLabel,
    sourceKind: state.sourceKind,
    report: state.previous.report,
    previous: null,
  };
}

/** Raised locally rather than by the server: the stream succeeded but produced nothing usable. */
export const AI_NOTHING_GENERATED_CODE = "ai_nothing_generated";

/**
 * Note what is *not* here: the prompt the user is *typing*. That lives in its own state in the hook,
 * which is why it survives a failed generation with no restore path to get wrong — `FAIL` returns to
 * `idle` and the textarea remounts with the text still in it. What the machine does keep is the
 * prompt each generation was *submitted* with, because that is what labels the draft on screen.
 */
/** A chunk that lands after Stop must not resurrect the generating view. */
function applySnapshot<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>,
  snapshot: TSurveyGenerationDraftSnapshot
): TAiCreateState<TReport, TPayload> {
  if (state.status !== "generating") return state;

  const draft = mergeAiDraftSnapshot(state.draft, snapshot);
  return draft === state.draft ? state : { ...state, draft };
}

function applyDone<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>,
  payload: TPayload,
  report: TReport | null = null
): TAiCreateState<TReport, TPayload> {
  // Same guard as SNAPSHOT, for the same reason: a terminal event from a run the user already
  // stopped would otherwise pair the restored draft with the abandoned run's payload — what you see
  // would no longer be what saving writes.
  if (state.status !== "generating") return state;

  // Judged on the payload, not on the preview: the preview is built from streamed partials, and a
  // provider that returns its object in one final chunk streams none — a perfectly good survey would
  // be reported as "nothing generated".
  if (isEmptyPayload(payload)) {
    return { ...INITIAL_AI_CREATE_STATE, errorCode: AI_NOTHING_GENERATED_CODE };
  }

  // The new draft supersedes whatever was held aside.
  return { ...state, status: "review", payload, report, errorCode: null, previous: null };
}

function applyStop<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>
): TAiCreateState<TReport, TPayload> {
  // Stopping a regeneration restores the draft it was trying to replace. The partial that was
  // streaming has no payload and could not be saved anyway, so the finished one always wins.
  if (state.previous) return restorePrevious(state);

  // First generation: keep whatever arrived so it is still actionable, or go back to the prompt.
  return state.draft.questions.length > 0 ? { ...state, status: "review" } : { ...INITIAL_AI_CREATE_STATE };
}

function applyFail<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>,
  errorCode: string
): TAiCreateState<TReport, TPayload> {
  // A failure belonging to an abandoned run must not tear down what the user went back to.
  if (state.status !== "generating") return state;

  // Discard the partial draft — a generation that died mid-write is not a trustworthy artifact — but
  // a failed regeneration still hands back the draft it was replacing.
  return restorePrevious(state, errorCode);
}

function applyEditPrompt<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>
): TAiCreateState<TReport, TPayload> {
  // Non-destructive: a finished draft is kept so the user can tweak the prompt, change their mind,
  // and go back to it. A half-written one is dropped — there is nothing to return to.
  if (state.payload) return { ...state, status: "idle", errorCode: null };
  // Mid-regeneration: drop the half-written draft but keep the finished one behind it.
  if (state.previous) return { ...restorePrevious(state), status: "idle" };

  return { ...INITIAL_AI_CREATE_STATE };
}

function applyRegenerate<TReport, TPayload extends TDraftPayload>(
  state: TAiCreateState<TReport, TPayload>,
  sourceLabel: string,
  sourceKind: TAiCreateSourceKind = state.sourceKind
): TAiCreateState<TReport, TPayload> {
  // Clear the visible list so the old one does not sit under the new stream, but hold it aside
  // rather than destroying it: Stop, or a failure, puts it straight back.
  return {
    status: "generating",
    draft: EMPTY_AI_DRAFT,
    payload: null,
    errorCode: null,
    sourceLabel,
    sourceKind,
    report: null,
    previous: state.payload
      ? { draft: state.draft, payload: state.payload, sourceLabel: state.sourceLabel, report: state.report }
      : state.previous,
  };
}

/**
 * A dispatch table rather than a switch full of logic: every case that has to decide something owns
 * a named function above, so the transitions can be read — and tested — one at a time.
 */
export function aiCreateReducer<TReport = never, TPayload extends TDraftPayload = TV3CreateSurveyBody>(
  state: TAiCreateState<TReport, TPayload>,
  action: TAiCreateAction<TReport, TPayload>
): TAiCreateState<TReport, TPayload> {
  switch (action.type) {
    case "SUBMIT":
      // A fresh prompt, so there is nothing worth holding on to.
      return {
        status: "generating",
        draft: EMPTY_AI_DRAFT,
        payload: null,
        errorCode: null,
        sourceLabel: action.sourceLabel,
        sourceKind: action.sourceKind ?? "prompt",
        report: null,
        previous: null,
      };

    case "SNAPSHOT":
      return applySnapshot(state, action.snapshot);

    case "DONE":
      return applyDone(state, action.payload, action.report);

    case "STOP":
      return applyStop(state);

    case "FAIL":
      return applyFail(state, action.errorCode);

    case "EDIT_PROMPT":
      return applyEditPrompt(state);

    case "BACK_TO_DRAFT":
      return state.payload ? { ...state, status: "review", errorCode: null } : state;

    case "REGENERATE":
      return applyRegenerate(state, action.sourceLabel, action.sourceKind);

    case "CREATE":
      return state.status === "review" && state.payload
        ? { ...state, status: "creating", errorCode: null }
        : state;

    case "CREATE_FAILED":
      // Unlike FAIL, this keeps the draft: the generation succeeded and the user already accepted
      // it, so a transient write failure should cost a retry, not ten seconds of regeneration.
      return { ...state, status: "review", errorCode: action.errorCode };

    case "CLEAR_ERROR":
      // Only the message goes. Dismissing an error is not a decision to throw away a kept draft —
      // and the example-prompt chips dismiss one on every click.
      return state.errorCode === null ? state : { ...state, errorCode: null };

    case "RESET":
      return INITIAL_AI_CREATE_STATE;
    default:
      return state;
  }
}
