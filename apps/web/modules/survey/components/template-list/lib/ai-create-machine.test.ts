import { describe, expect, test } from "vitest";
import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { INITIAL_AI_CREATE_STATE, aiCreateReducer } from "./ai-create-machine";

/** Shaped like the real thing: `DONE` judges "did anything get generated" on the payload's blocks. */
const buildPayload = (name: string): TV3CreateSurveyBody =>
  ({
    name,
    blocks: [{ name: "Block", elements: [{ type: "openText", headline: "How was it?" }] }],
  }) as unknown as TV3CreateSurveyBody;

const payload = buildPayload("Onboarding");

const snapshot = (headline: string): TSurveyGenerationDraftSnapshot =>
  ({
    name: "Onboarding",
    blocks: [{ name: "Block", questions: [{ type: "openText", headline }] }],
  }) as TSurveyGenerationDraftSnapshot;

const generatingWithOneQuestion = () =>
  aiCreateReducer(aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT", prompt: "a prompt" }), {
    type: "SNAPSHOT",
    snapshot: snapshot("How was it?"),
  });

describe("aiCreateReducer", () => {
  test("SUBMIT enters generating with a clean slate", () => {
    const state = aiCreateReducer(
      { ...INITIAL_AI_CREATE_STATE, errorCode: "ai_generation_failed" },
      { type: "SUBMIT", prompt: "a prompt" }
    );

    expect(state.status).toBe("generating");
    expect(state.errorCode).toBeNull();
    expect(state.draft.questions).toHaveLength(0);
  });

  test("SNAPSHOT while generating folds into the draft", () => {
    expect(generatingWithOneQuestion().draft.questions).toHaveLength(1);
  });

  test("SNAPSHOT outside generating is ignored", () => {
    // A chunk arriving after Stop must not resurrect the generating view.
    const stopped = aiCreateReducer(generatingWithOneQuestion(), { type: "STOP" });

    const after = aiCreateReducer(stopped, { type: "SNAPSHOT", snapshot: snapshot("Late arrival") });

    expect(after).toBe(stopped);
    expect(after.status).toBe("review");
  });

  test("DONE moves to review and keeps the payload", () => {
    const state = aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload });

    expect(state.status).toBe("review");
    expect(state.payload).toBe(payload);
  });

  test("DONE carrying nothing to answer is treated as a failure", () => {
    const generating = aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT", prompt: "a prompt" });
    const empty = {
      name: "Onboarding",
      blocks: [{ name: "Block", elements: [] }],
    } as unknown as typeof payload;

    const state = aiCreateReducer(generating, { type: "DONE", payload: empty });

    expect(state.status).toBe("idle");
    expect(state.errorCode).toBe("ai_nothing_generated");
    expect(state.payload).toBeNull();
  });

  test("DONE succeeds even when no partial ever arrived", () => {
    // A provider that returns its object in one final chunk streams no partials, so the preview is
    // empty at this point. Judging success on the preview reported a perfectly good survey as
    // "nothing generated".
    const generating = aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT", prompt: "a prompt" });
    expect(generating.draft.questions).toHaveLength(0);

    const state = aiCreateReducer(generating, { type: "DONE", payload });

    expect(state.status).toBe("review");
    expect(state.payload).toBe(payload);
    expect(state.errorCode).toBeNull();
  });

  test("STOP keeps a partial draft the user can still act on", () => {
    const state = aiCreateReducer(generatingWithOneQuestion(), { type: "STOP" });

    expect(state.status).toBe("review");
    expect(state.draft.questions).toHaveLength(1);
  });

  test("STOP with nothing generated returns to the prompt", () => {
    const generating = aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT", prompt: "a prompt" });

    expect(aiCreateReducer(generating, { type: "STOP" }).status).toBe("idle");
  });

  test("FAIL discards the partial draft", () => {
    // A review footer over a half-written draft is a lie about what the user has.
    const state = aiCreateReducer(generatingWithOneQuestion(), {
      type: "FAIL",
      errorCode: "ai_generation_failed",
    });

    expect(state.status).toBe("idle");
    expect(state.draft.questions).toHaveLength(0);
    expect(state.errorCode).toBe("ai_generation_failed");
  });

  test("REGENERATE clears the old draft before re-entering generating", () => {
    const reviewing = aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload });

    const state = aiCreateReducer(reviewing, { type: "REGENERATE", prompt: "a prompt" });

    expect(state.status).toBe("generating");
    expect(state.draft.questions).toHaveLength(0);
    expect(state.payload).toBeNull();
  });

  test("CREATE_FAILED keeps the reviewed draft so the write can be retried", () => {
    // Unlike FAIL: the generation succeeded and the user accepted it, so a transient write failure
    // must not cost them ten seconds of regeneration.
    const creating = aiCreateReducer(
      aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload }),
      { type: "CREATE" }
    );

    const state = aiCreateReducer(creating, { type: "CREATE_FAILED", errorCode: "ai_unknown" });

    expect(state.status).toBe("review");
    expect(state.draft.questions).toHaveLength(1);
    expect(state.payload).toBe(payload);
    expect(state.errorCode).toBe("ai_unknown");
  });

  test("CREATE only advances from review with a payload", () => {
    const reviewing = aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload });

    expect(aiCreateReducer(reviewing, { type: "CREATE" }).status).toBe("creating");
    expect(aiCreateReducer(generatingWithOneQuestion(), { type: "CREATE" }).status).toBe("generating");
  });
});

describe("the prompt the draft came from", () => {
  test("SUBMIT records the prompt that was sent", () => {
    const state = aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT", prompt: "measure onboarding" });

    expect(state.submittedPrompt).toBe("measure onboarding");
  });

  test("editing the prompt leaves the kept draft labelled with the prompt that produced it", () => {
    const reviewed = aiCreateReducer(
      aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload }),
      { type: "EDIT_PROMPT" }
    );

    // The user is now typing something else; the chip above the kept draft must not follow along.
    expect(aiCreateReducer(reviewed, { type: "BACK_TO_DRAFT" }).submittedPrompt).toBe("a prompt");
  });

  test("Stop restores the prompt belonging to the draft it puts back", () => {
    const reviewed = aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload });
    const regenerating = aiCreateReducer(reviewed, { type: "REGENERATE", prompt: "something else" });
    expect(regenerating.submittedPrompt).toBe("something else");

    expect(aiCreateReducer(regenerating, { type: "STOP" }).submittedPrompt).toBe("a prompt");
  });
});

describe("dismissing an error", () => {
  test("CLEAR_ERROR keeps the draft the user has not chosen to discard", () => {
    // The example-prompt chips call this on every click; it used to reset the whole machine.
    const kept = aiCreateReducer(
      aiCreateReducer(aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload }), {
        type: "EDIT_PROMPT",
      }),
      { type: "CREATE_FAILED", errorCode: "ai_generation_failed" }
    );

    const cleared = aiCreateReducer(kept, { type: "CLEAR_ERROR" });

    expect(cleared.errorCode).toBeNull();
    expect(cleared.payload).toBe(payload);
    expect(cleared.draft.questions).toHaveLength(1);
  });
});

describe("terminal events from an abandoned generation", () => {
  test("DONE after Stop does not pair the restored draft with the new payload", () => {
    const stopped = aiCreateReducer(generatingWithOneQuestion(), { type: "STOP" });
    expect(stopped.status).toBe("review");

    const late = aiCreateReducer(stopped, {
      type: "DONE",
      payload: buildPayload("Other"),
    });

    expect(late).toBe(stopped);
  });

  test("FAIL after Stop does not tear down what the user went back to", () => {
    const stopped = aiCreateReducer(generatingWithOneQuestion(), { type: "STOP" });

    const late = aiCreateReducer(stopped, { type: "FAIL", errorCode: "ai_generation_failed" });

    expect(late).toBe(stopped);
    expect(late.errorCode).toBeNull();
  });
});

describe("editing the prompt without losing a finished draft", () => {
  const reviewing = () => aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload });

  test("EDIT_PROMPT keeps a finished draft so the user can come back to it", () => {
    const state = aiCreateReducer(reviewing(), { type: "EDIT_PROMPT" });

    expect(state.status).toBe("idle");
    expect(state.draft.questions).toHaveLength(1);
    expect(state.payload).toBe(payload);
  });

  test("BACK_TO_DRAFT returns to the kept draft", () => {
    const edited = aiCreateReducer(reviewing(), { type: "EDIT_PROMPT" });

    const state = aiCreateReducer(edited, { type: "BACK_TO_DRAFT" });

    expect(state.status).toBe("review");
    expect(state.draft.questions).toHaveLength(1);
  });

  test("EDIT_PROMPT drops a half-written draft, which there is no going back to", () => {
    const state = aiCreateReducer(generatingWithOneQuestion(), { type: "EDIT_PROMPT" });

    expect(state.draft.questions).toHaveLength(0);
    expect(aiCreateReducer(state, { type: "BACK_TO_DRAFT" }).status).toBe("idle");
  });
});

describe("regenerating does not cost you the draft you had", () => {
  const finished = () => aiCreateReducer(generatingWithOneQuestion(), { type: "DONE", payload });
  const regenerating = () => aiCreateReducer(finished(), { type: "REGENERATE", prompt: "a prompt" });

  test("the finished draft is held aside, not destroyed", () => {
    const state = regenerating();

    expect(state.status).toBe("generating");
    expect(state.draft.questions).toHaveLength(0); // cleared from view
    expect(state.previous?.payload).toBe(payload); // but kept
  });

  test("Stop puts the previous draft back, payload and all", () => {
    // The case that bit: stopping mid-regeneration used to leave a partial with no payload, so
    // "Save and continue" had nothing to save.
    const state = aiCreateReducer(regenerating(), { type: "STOP" });

    expect(state.status).toBe("review");
    expect(state.draft.questions).toHaveLength(1);
    expect(state.payload).toBe(payload);
    expect(state.previous).toBeNull();
  });

  test("Stop restores the previous draft even when the new one had already streamed rows", () => {
    // The partial has no payload and cannot be saved, so the finished draft always wins.
    const partway = aiCreateReducer(regenerating(), {
      type: "SNAPSHOT",
      snapshot: snapshot("A different question"),
    });
    expect(partway.draft.questions).toHaveLength(1);

    const state = aiCreateReducer(partway, { type: "STOP" });

    expect(state.draft.questions[0].headline).toBe("How was it?");
    expect(state.payload).toBe(payload);
  });

  test("a failed regeneration hands the draft back with the error", () => {
    const state = aiCreateReducer(regenerating(), { type: "FAIL", errorCode: "ai_generation_failed" });

    expect(state.status).toBe("review");
    expect(state.payload).toBe(payload);
    expect(state.errorCode).toBe("ai_generation_failed");
  });

  test("a finished regeneration supersedes what was held aside", () => {
    const nextPayload = buildPayload("Second");
    const streamed = aiCreateReducer(regenerating(), { type: "SNAPSHOT", snapshot: snapshot("New") });

    const state = aiCreateReducer(streamed, { type: "DONE", payload: nextPayload });

    expect(state.payload).toBe(nextPayload);
    expect(state.previous).toBeNull();
  });

  test("editing the prompt mid-regeneration still leaves a draft to come back to", () => {
    const state = aiCreateReducer(regenerating(), { type: "EDIT_PROMPT" });

    expect(state.status).toBe("idle");
    expect(state.payload).toBe(payload);
    expect(aiCreateReducer(state, { type: "BACK_TO_DRAFT" }).draft.questions).toHaveLength(1);
  });

  test("stopping a first generation is unaffected — there is nothing to restore", () => {
    const state = aiCreateReducer(generatingWithOneQuestion(), { type: "STOP" });

    expect(state.status).toBe("review");
    expect(state.draft.questions).toHaveLength(1);
  });
});
