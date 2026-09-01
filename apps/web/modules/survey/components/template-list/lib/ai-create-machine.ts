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
   * The prompt that produced what is on screen — not the one in the textarea. Editing the prompt
   * keeps the finished draft, so rendering the live text would label an old draft with words that
   * had no part in it, right where the user checks it before saving.
   */
  submittedPrompt: string;
  /**
   * The last finished draft, held aside while a regeneration runs. Regenerating is a gamble on a
   * better result: abandoning it, or having it fail, must not cost the one the user already had.
   */
  previous: { draft: TAiDraftState; payload: TV3CreateSurveyBody; submittedPrompt: string } | null;
}

export type TAiCreateAction =
  | { type: "SUBMIT"; prompt: string }
  | { type: "SNAPSHOT"; snapshot: TSurveyGenerationDraftSnapshot }
  | { type: "DONE"; payload: TV3CreateSurveyBody }
  | { type: "STOP" }
  | { type: "FAIL"; errorCode: string }
  | { type: "CREATE_FAILED"; errorCode: string }
  | { type: "EDIT_PROMPT" }
  | { type: "BACK_TO_DRAFT" }
  | { type: "REGENERATE"; prompt: string }
  | { type: "CREATE" }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

export const INITIAL_AI_CREATE_STATE: TAiCreateState = {
  status: "idle",
  draft: EMPTY_AI_DRAFT,
  payload: null,
  errorCode: null,
  submittedPrompt: "",
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
function restorePrevious(state: TAiCreateState, errorCode: string | null = null): TAiCreateState {
  if (!state.previous) {
    return { ...INITIAL_AI_CREATE_STATE, errorCode };
  }

  return {
    status: "review",
    draft: state.previous.draft,
    payload: state.previous.payload,
    errorCode,
    submittedPrompt: state.previous.submittedPrompt,
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
export function aiCreateReducer(state: TAiCreateState, action: TAiCreateAction): TAiCreateState {
  switch (action.type) {
    case "SUBMIT":
      // A fresh prompt, so there is nothing worth holding on to.
      return {
        status: "generating",
        draft: EMPTY_AI_DRAFT,
        payload: null,
        errorCode: null,
        submittedPrompt: action.prompt,
        previous: null,
      };

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

      // Judged on the payload, not on the preview: the preview is built from streamed partials, and
      // a provider that returns its object in one final chunk streams none — a perfectly good survey
      // would be reported as "nothing generated".
      if (isEmptyPayload(action.payload)) {
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
        submittedPrompt: action.prompt,
        previous: state.payload
          ? { draft: state.draft, payload: state.payload, submittedPrompt: state.submittedPrompt }
          : state.previous,
      };

    case "CREATE":
      if (state.status !== "review" || !state.payload) return state;
      return { ...state, status: "creating", errorCode: null };

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
