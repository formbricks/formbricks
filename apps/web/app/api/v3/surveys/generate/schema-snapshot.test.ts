import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ZGeneratedSurveyDraftForAI } from "./schemas";

/**
 * The provider-facing JSON schema for Create with AI is pinned. The import lane reuses the draft
 * schema through a factory (D2); this snapshot proves that refactor left the prompt-create schema
 * byte-identical, so the model keeps seeing exactly what it saw before.
 */
describe("ZGeneratedSurveyDraftForAI provider schema", () => {
  test("is byte-identical to the pinned JSON schema", async () => {
    const jsonSchema = z.toJSONSchema(ZGeneratedSurveyDraftForAI, { target: "draft-7", io: "input" });
    await expect(JSON.stringify(jsonSchema, null, 2)).toMatchFileSnapshot(
      "./__snapshots__/generated-survey-draft-for-ai.schema.snap"
    );
  });
});
