import { describe, expect, test } from "vitest";
import type { TSurveyGenerationDraftSnapshot } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { INITIAL_AI_CREATE_STATE, aiCreateReducer } from "./ai-create-machine";

const payload = { name: "Onboarding" } as TV3CreateSurveyBody;

const snapshot = (headline: string): TSurveyGenerationDraftSnapshot =>
  ({
    name: "Onboarding",
    blocks: [{ name: "Block", questions: [{ type: "openText", headline }] }],
  }) as TSurveyGenerationDraftSnapshot;

const generatingWithOneQuestion = () =>
  aiCreateReducer(aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT" }), {
    type: "SNAPSHOT",
    snapshot: snapshot("How was it?"),
  });

describe("aiCreateReducer", () => {
  test("SUBMIT enters generating with a clean slate", () => {
    const state = aiCreateReducer(
      { ...INITIAL_AI_CREATE_STATE, errorCode: "ai_generation_failed" },
      { type: "SUBMIT" }
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

  test("DONE with an empty draft is treated as a failure", () => {
    const generating = aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT" });

    const state = aiCreateReducer(generating, { type: "DONE", payload });

    expect(state.status).toBe("idle");
    expect(state.errorCode).toBe("ai_nothing_generated");
    expect(state.payload).toBeNull();
  });

  test("STOP keeps a partial draft the user can still act on", () => {
    const state = aiCreateReducer(generatingWithOneQuestion(), { type: "STOP" });

    expect(state.status).toBe("review");
    expect(state.draft.questions).toHaveLength(1);
  });

  test("STOP with nothing generated returns to the prompt", () => {
    const generating = aiCreateReducer(INITIAL_AI_CREATE_STATE, { type: "SUBMIT" });

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

    const state = aiCreateReducer(reviewing, { type: "REGENERATE" });

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
  const regenerating = () => aiCreateReducer(finished(), { type: "REGENERATE" });

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
    const nextPayload = { name: "Second" } as TV3CreateSurveyBody;
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
