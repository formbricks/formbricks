import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  EMPTY_AI_DRAFT,
  type TAiDraftState,
  mergeAiDraftSnapshot,
  replaceAiDraftSnapshot,
} from "./ai-draft-reducer";

export type TAiCreateStatus = "idle" | "generating" | "review" | "creating";

/** What produced the draft on screen: a typed prompt (Create with AI) or a dropped file (Import). */
export type TAiCreateSourceKind = "prompt" | "file";

export interface TAiCreateState {
  status: TAiCreateStatus;
  draft: TAiDraftState;
  /** The validated create payload. Only ever set from the stream's terminal event. */
  payload: TV3CreateSurveyBody | null;
  /** An error code, not a message, so the reducer stays free of `t`. */
  errorCode: string | null;
  /** The server's support handle for the failed run, when the error event carried one. */
  errorReference: string | null;
  /**
   * The source that produced what is on screen — the submitted prompt text, or the file name — not
   * the one in the input. Editing the prompt keeps the finished draft, so rendering the live text
   * would label an old draft with words that had no part in it, right where the user checks it
   * before saving. Display only.
   */
  sourceLabel: string;
  sourceKind: TAiCreateSourceKind;
  /**
   * Import lanes produce a report next to the payload; Create with AI has none. Set by `DONE`,
   * cleared whenever a new run starts.
   */
  report: unknown | null;
  /**
   * The last finished draft, held aside while a regeneration runs. Regenerating is a gamble on a
   * better result: abandoning it, or having it fail, must not cost the one the user already had.
   */
  previous: {
    draft: TAiDraftState;
    payload: TV3CreateSurveyBody;
    sourceLabel: string;
    report: unknown | null;
  } | null;
}

export type TAiCreateAction =
  | { type: "SUBMIT"; prompt: string; sourceKind?: TAiCreateSourceKind }
  /** `blockOffset` shifts the snapshot's block indices: chunked imports append blocks (D4). */
  | { type: "SNAPSHOT"; snapshot: TSurveyGenerationDraftSnapshot; blockOffset?: number; replace?: boolean }
  | { type: "DONE"; payload: TV3CreateSurveyBody; report?: unknown }
  | { type: "STOP" }
  | { type: "FAIL"; errorCode: string; errorReference?: string }
  | { type: "CREATE_FAILED"; errorCode: string }
  | { type: "EDIT_PROMPT" }
  | { type: "BACK_TO_DRAFT" }
  | { type: "REGENERATE"; prompt: string; sourceKind?: TAiCreateSourceKind }
  | { type: "CREATE" }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

export const INITIAL_AI_CREATE_STATE: TAiCreateState = {
  status: "idle",
  draft: EMPTY_AI_DRAFT,
  payload: null,
  errorCode: null,
  errorReference: null,
  sourceLabel: "",
  sourceKind: "prompt",
  report: null,
  previous: null,
};

/**
 * Whether the terminal payload actually carries a survey. The create body nests elements inside
 * blocks, so a payload can have blocks and still have nothing to answer.
 */
function isEmptyPayload(payload: TV3CreateSurveyBody): boolean {
  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];

  return !blocks.some((block) => Array.isArray(block?.elements) && block.elements.length > 0);
}

/** Put a held-aside draft back on screen, or fall back to a clean slate when there is none. */
function restorePrevious(
  state: TAiCreateState,
  errorCode: string | null = null,
  errorReference: string | null = null
): TAiCreateState {
  if (!state.previous) {
    return { ...INITIAL_AI_CREATE_STATE, errorCode, errorReference };
  }

  return {
    status: "review",
    draft: state.previous.draft,
    payload: state.previous.payload,
    errorCode,
    errorReference,
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
function applySnapshot(
  state: TAiCreateState,
  snapshot: TSurveyGenerationDraftSnapshot,
  blockOffset = 0,
  replace = false
): TAiCreateState {
  if (state.status !== "generating") return state;

  const draft = replace
    ? replaceAiDraftSnapshot(snapshot)
    : mergeAiDraftSnapshot(state.draft, snapshot, blockOffset);
  return draft === state.draft ? state : { ...state, draft };
}

function applyDone(
  state: TAiCreateState,
  payload: TV3CreateSurveyBody,
  report: unknown = null
): TAiCreateState {
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
  return {
    ...state,
    status: "review",
    payload,
    report,
    errorCode: null,
    errorReference: null,
    previous: null,
  };
}

function applyStop(state: TAiCreateState): TAiCreateState {
  // Stopping a regeneration restores the draft it was trying to replace. The partial that was
  // streaming has no payload and could not be saved anyway, so the finished one always wins.
  if (state.previous) return restorePrevious(state);

  // First generation: keep whatever arrived so it is still actionable, or go back to the prompt.
  return state.draft.questions.length > 0 ? { ...state, status: "review" } : { ...INITIAL_AI_CREATE_STATE };
}

function applyFail(state: TAiCreateState, errorCode: string, errorReference?: string): TAiCreateState {
  // A failure belonging to an abandoned run must not tear down what the user went back to.
  if (state.status !== "generating") return state;

  // Discard the partial draft — a generation that died mid-write is not a trustworthy artifact — but
  // a failed regeneration still hands back the draft it was replacing.
  return restorePrevious(state, errorCode, errorReference ?? null);
}

function applyEditPrompt(state: TAiCreateState): TAiCreateState {
  // Non-destructive: a finished draft is kept so the user can tweak the prompt, change their mind,
  // and go back to it. A half-written one is dropped — there is nothing to return to.
  if (state.payload) return { ...state, status: "idle", errorCode: null, errorReference: null };
  // Mid-regeneration: drop the half-written draft but keep the finished one behind it.
  if (state.previous) return { ...restorePrevious(state), status: "idle" };

  return { ...INITIAL_AI_CREATE_STATE };
}

function applyRegenerate(
  state: TAiCreateState,
  prompt: string,
  sourceKind: TAiCreateSourceKind = state.sourceKind
): TAiCreateState {
  // Clear the visible list so the old one does not sit under the new stream, but hold it aside
  // rather than destroying it: Stop, or a failure, puts it straight back.
  return {
    status: "generating",
    draft: EMPTY_AI_DRAFT,
    payload: null,
    errorCode: null,
    errorReference: null,
    sourceLabel: prompt,
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
export function aiCreateReducer(state: TAiCreateState, action: TAiCreateAction): TAiCreateState {
  switch (action.type) {
    case "SUBMIT":
      // A fresh prompt, so there is nothing worth holding on to.
      return {
        status: "generating",
        draft: EMPTY_AI_DRAFT,
        payload: null,
        errorCode: null,
        errorReference: null,
        sourceLabel: action.prompt,
        sourceKind: action.sourceKind ?? "prompt",
        report: null,
        previous: null,
      };

    case "SNAPSHOT":
      return applySnapshot(state, action.snapshot, action.blockOffset, action.replace);

    case "DONE":
      return applyDone(state, action.payload, action.report);

    case "STOP":
      return applyStop(state);

    case "FAIL":
      return applyFail(state, action.errorCode, action.errorReference);

    case "EDIT_PROMPT":
      return applyEditPrompt(state);

    case "BACK_TO_DRAFT":
      return state.payload ? { ...state, status: "review", errorCode: null, errorReference: null } : state;

    case "REGENERATE":
      return applyRegenerate(state, action.prompt, action.sourceKind);

    case "CREATE":
      return state.status === "review" && state.payload
        ? { ...state, status: "creating", errorCode: null, errorReference: null }
        : state;

    case "CREATE_FAILED":
      // Unlike FAIL, this keeps the draft: the generation succeeded and the user already accepted
      // it, so a transient write failure should cost a retry, not ten seconds of regeneration.
      return { ...state, status: "review", errorCode: action.errorCode, errorReference: null };

    case "CLEAR_ERROR":
      // Only the message goes. Dismissing an error is not a decision to throw away a kept draft —
      // and the example-prompt chips dismiss one on every click.
      return state.errorCode === null ? state : { ...state, errorCode: null, errorReference: null };

    case "RESET":
      return INITIAL_AI_CREATE_STATE;
    default:
      return state;
  }
}
