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
