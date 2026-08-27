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
}

export type TAiCreateAction =
  | { type: "SUBMIT" }
  | { type: "SNAPSHOT"; snapshot: TSurveyGenerationDraftSnapshot }
  | { type: "DONE"; payload: TV3CreateSurveyBody }
  | { type: "STOP" }
  | { type: "FAIL"; errorCode: string }
  | { type: "CREATE_FAILED"; errorCode: string }
  | { type: "EDIT_PROMPT" }
  | { type: "REGENERATE" }
  | { type: "CREATE" }
  | { type: "RESET" };

export const INITIAL_AI_CREATE_STATE: TAiCreateState = {
  status: "idle",
  draft: EMPTY_AI_DRAFT,
  payload: null,
  errorCode: null,
};

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
      return { status: "generating", draft: EMPTY_AI_DRAFT, payload: null, errorCode: null };

    case "SNAPSHOT": {
      // A chunk that lands after Stop must not resurrect the generating view.
      if (state.status !== "generating") return state;

      const draft = mergeAiDraftSnapshot(state.draft, action.snapshot);
      return draft === state.draft ? state : { ...state, draft };
    }

    case "DONE": {
      // An empty draft is a failure wearing a success hat.
      if (state.draft.questions.length === 0) {
        return { ...INITIAL_AI_CREATE_STATE, errorCode: AI_NOTHING_GENERATED_CODE };
      }

      return { ...state, status: "review", payload: action.payload, errorCode: null };
    }

    case "STOP":
      // Keep a partial draft the user can still act on; with nothing to show, go back to the prompt.
      return state.draft.questions.length > 0
        ? { ...state, status: "review" }
        : { ...INITIAL_AI_CREATE_STATE };

    case "FAIL":
      // Discard the partial draft: a generation that died mid-write is not a trustworthy artifact,
      // and a review footer over a broken draft is a lie about what the user has.
      return { ...INITIAL_AI_CREATE_STATE, errorCode: action.errorCode };

    case "EDIT_PROMPT":
      return { ...INITIAL_AI_CREATE_STATE };

    case "REGENERATE":
      // Clear before re-entering so the previous list does not sit under the new stream.
      return { status: "generating", draft: EMPTY_AI_DRAFT, payload: null, errorCode: null };

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
