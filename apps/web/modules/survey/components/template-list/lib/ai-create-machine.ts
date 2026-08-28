import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { EMPTY_AI_DRAFT, type TAiDraftState, mergeAiDraftSnapshot } from "./ai-draft-reducer";

export type TAiCreateStatus = "idle" | "generating" | "review" | "creating";

export interface TAiCreateState {
  status: TAiCreateStatus;
  draft: TAiDraftState;
  /** The validated create payload. Only ever set from the stream's terminal event. */
  payload: TV3CreateSurveyBody | null;
  /** An error code, not a message, so the reducer stays free of `t`. */
  errorCode: string | null;
  /**
   * The last finished draft, held aside while a regeneration runs. Regenerating is a gamble on a
   * better result: abandoning it, or having it fail, must not cost the one the user already had.
   */
  previous: { draft: TAiDraftState; payload: TV3CreateSurveyBody } | null;
}

export type TAiCreateAction =
  | { type: "SUBMIT" }
  | { type: "SNAPSHOT"; snapshot: TSurveyGenerationDraftSnapshot }
  | { type: "DONE"; payload: TV3CreateSurveyBody }
  | { type: "STOP" }
  | { type: "FAIL"; errorCode: string }
  | { type: "CREATE_FAILED"; errorCode: string }
  | { type: "EDIT_PROMPT" }
  | { type: "BACK_TO_DRAFT" }
  | { type: "REGENERATE" }
  | { type: "CREATE" }
  | { type: "RESET" };

export const INITIAL_AI_CREATE_STATE: TAiCreateState = {
  status: "idle",
  draft: EMPTY_AI_DRAFT,
  payload: null,
  errorCode: null,
  previous: null,
};

/** Put a held-aside draft back on screen, or fall back to a clean slate when there is none. */
function restorePrevious(state: TAiCreateState, errorCode: string | null = null): TAiCreateState {
  if (!state.previous) {
    return { ...INITIAL_AI_CREATE_STATE, errorCode };
  }

  return {
    status: "review",
    draft: state.previous.draft,
    payload: state.previous.payload,
    errorCode,
    previous: null,
  };
}

/** Raised locally rather than by the server: the stream succeeded but produced nothing usable. */
export const AI_NOTHING_GENERATED_CODE = "ai_nothing_generated";

/**
 * Note what is *not* here: the prompt. It lives in its own state in the hook, which is why it
 * survives a failed generation with no restore path to get wrong — `FAIL` returns to `idle` and the
 * textarea remounts with the text still in it.
 */
export function aiCreateReducer(state: TAiCreateState, action: TAiCreateAction): TAiCreateState {
  switch (action.type) {
    case "SUBMIT":
      // A fresh prompt, so there is nothing worth holding on to.
      return { status: "generating", draft: EMPTY_AI_DRAFT, payload: null, errorCode: null, previous: null };

    case "SNAPSHOT": {
      // A chunk that lands after Stop must not resurrect the generating view.
      if (state.status !== "generating") return state;

      const draft = mergeAiDraftSnapshot(state.draft, action.snapshot);
      return draft === state.draft ? state : { ...state, draft };
    }

    case "DONE": {
      // Same guard as SNAPSHOT, for the same reason: a terminal event from a run the user already
      // stopped would otherwise pair the restored draft with the abandoned run's payload — what you
      // see would no longer be what saving writes.
      if (state.status !== "generating") return state;

      // An empty draft is a failure wearing a success hat.
      if (state.draft.questions.length === 0) {
        return { ...INITIAL_AI_CREATE_STATE, errorCode: AI_NOTHING_GENERATED_CODE };
      }

      // The new draft supersedes whatever was held aside.
      return { ...state, status: "review", payload: action.payload, errorCode: null, previous: null };
    }

    case "STOP":
      // Stopping a regeneration restores the draft it was trying to replace. The partial that was
      // streaming has no payload and could not be saved anyway, so the finished one always wins.
      if (state.previous) return restorePrevious(state);

      // First generation: keep whatever arrived so it is still actionable, or go back to the prompt.
      return state.draft.questions.length > 0
        ? { ...state, status: "review" }
        : { ...INITIAL_AI_CREATE_STATE };

    case "FAIL":
      // A failure belonging to an abandoned run must not tear down what the user went back to.
      if (state.status !== "generating") return state;

      // Discard the partial draft — a generation that died mid-write is not a trustworthy artifact
      // — but a failed regeneration still hands back the draft it was replacing.
      return restorePrevious(state, action.errorCode);

    case "EDIT_PROMPT":
      // Non-destructive: a finished draft is kept so the user can tweak the prompt, change their
      // mind, and go back to it. A half-written one is dropped — there is nothing to return to.
      if (state.payload) return { ...state, status: "idle", errorCode: null };
      // Mid-regeneration: drop the half-written draft but keep the finished one behind it.
      if (state.previous) return { ...restorePrevious(state), status: "idle" };
      return { ...INITIAL_AI_CREATE_STATE };

    case "BACK_TO_DRAFT":
      if (!state.payload) return state;
      return { ...state, status: "review", errorCode: null };

    case "REGENERATE":
      // Clear the visible list so the old one does not sit under the new stream, but hold it aside
      // rather than destroying it: Stop, or a failure, puts it straight back.
      return {
        status: "generating",
        draft: EMPTY_AI_DRAFT,
        payload: null,
        errorCode: null,
        previous: state.payload ? { draft: state.draft, payload: state.payload } : state.previous,
      };

    case "CREATE":
      if (state.status !== "review" || !state.payload) return state;
      return { ...state, status: "creating", errorCode: null };

    case "CREATE_FAILED":
      // Unlike FAIL, this keeps the draft: the generation succeeded and the user already accepted
      // it, so a transient write failure should cost a retry, not ten seconds of regeneration.
      return { ...state, status: "review", errorCode: action.errorCode };

    case "RESET":
      return INITIAL_AI_CREATE_STATE;

    default:
      return state;
  }
}
