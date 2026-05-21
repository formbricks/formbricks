import { describe, expect, test } from "vitest";
import {
  ZV3CreateSurveyBody,
  ZV3PatchSurveyBody,
  createZV3PatchSurveyBodySchema,
  formatV3ZodInvalidParams,
} from "./schemas";

const validCreateBody = {
  workspaceId: "clxx1234567890123456789012",
  name: "Product Feedback",
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      elements: [
        {
          id: "satisfaction",
          type: "openText",
          headline: { "en-US": "What should we improve?" },
          required: true,
        },
      ],
    },
  ],
};

describe("ZV3CreateSurveyBody", () => {
  test("accepts a valid block-based create body and applies public defaults", () => {
    const parsed = ZV3CreateSurveyBody.parse(validCreateBody);

    expect(parsed).toMatchObject({
      workspaceId: validCreateBody.workspaceId,
      name: "Product Feedback",
      type: "link",
      status: "draft",
      metadata: {},
      defaultLanguage: "en-US",
      languages: [],
      welcomeCard: { enabled: false },
      endings: [],
      hiddenFields: { enabled: false },
      variables: [],
    });
    expect(parsed.blocks[0].elements[0]).toMatchObject({
      headline: { default: "What should we improve?" },
    });
  });

  test("generates server-managed block and variable ids on create when omitted", () => {
    const parsed = ZV3CreateSurveyBody.parse({
      ...validCreateBody,
      blocks: [
        {
          name: "Generated ID Block",
          elements: validCreateBody.blocks[0].elements,
        },
      ],
      variables: [
        {
          name: "score",
          type: "number",
          value: 0,
        },
      ],
    });

    expect(parsed.blocks[0].id).toEqual(expect.any(String));
    expect(parsed.blocks[0].id.length).toBeGreaterThan(0);
    expect(parsed.variables[0].id).toEqual(expect.any(String));
    expect(parsed.variables[0].id.length).toBeGreaterThan(0);
  });

  test("normalizes locale maps and language codes before shared survey validation", () => {
    const parsed = ZV3CreateSurveyBody.parse({
      ...validCreateBody,
      defaultLanguage: "en_us",
      languages: [{ code: "de_de" }],
      welcomeCard: {
        enabled: true,
        headline: { en_us: "Welcome", de_de: "Willkommen" },
      },
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
              headline: { en_us: "Hello", de_de: "Hallo" },
            },
          ],
        },
      ],
    });

    expect(parsed.defaultLanguage).toBe("en-US");
    expect(parsed.languages).toEqual([{ code: "de-DE", enabled: true }]);
    expect(parsed.welcomeCard).toMatchObject({
      headline: { default: "Welcome", "de-DE": "Willkommen" },
    });
    expect(parsed.blocks[0].elements[0]).toMatchObject({
      headline: { default: "Hello", "de-DE": "Hallo" },
    });
  });

  test("rejects an invalid defaultLanguage instead of silently defaulting", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      defaultLanguage: "not a locale",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("defaultLanguage");
  });

  test("rejects duplicate locale keys after normalization", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
              headline: { "en-US": "Hello", en_us: "Duplicate" },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "blocks.0.elements.0.headline.en_us"
    );
  });

  test("rejects unsupported top-level fields instead of silently ignoring them", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      questions: [],
      styling: {},
      createdBy: "user_1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["questions", "styling", "createdBy"])
    );
  });

  test("rejects unsupported nested fields instead of stripping them", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          targeting: {},
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
              analytics: {},
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["blocks.0.targeting", "blocks.0.elements.0.analytics"])
    );
  });

  test("rejects element fields that do not belong to the selected element type", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
              buttonUrl: "https://example.com",
              scale: "star",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "blocks.0.elements.0.buttonUrl"
    );
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("blocks.0.elements.0.scale");
    expect(
      result.error?.issues.find((issue) => issue.path.join(".") === "blocks.0.elements.0.buttonUrl")
    ).toMatchObject({
      message: expect.stringContaining("element type 'openText'"),
    });
  });

  test("rejects choice fields that do not belong to the selected element type", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              id: "choices",
              type: "multipleChoiceSingle",
              headline: { "en-US": "Pick one" },
              required: true,
              choices: [
                { id: "choice_1", label: { "en-US": "A" }, imageUrl: "https://example.com/a.png" },
                { id: "choice_2", label: { "en-US": "B" } },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "blocks.0.elements.0.choices.0.imageUrl"
    );
    expect(
      result.error?.issues.find((issue) => issue.path.join(".") === "blocks.0.elements.0.choices.0.imageUrl")
    ).toMatchObject({
      message: expect.stringContaining("Allowed fields: id, label"),
    });
  });

  test("does not rewrite locale-shaped objects in logic metadata", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
            },
          ],
          logic: [
            {
              id: "cllog123456789012345678901",
              conditions: {
                id: "clgrp123456789012345678901",
                connector: "and",
                conditions: [
                  {
                    id: "clcon123456789012345678901",
                    leftOperand: {
                      type: "element",
                      value: "satisfaction",
                      meta: { "en-US": "metadata" },
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: "clact123456789012345678901",
                  objective: "requireAnswer",
                  target: "satisfaction",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected schema validation to pass");
    }
    expect(result.data.blocks[0].logic?.[0].conditions.conditions[0]).toMatchObject({
      leftOperand: {
        meta: { "en-US": "metadata" },
      },
    });
  });

  test("rejects the internal default translation key in public v3 input", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
              headline: { default: "Internal key should not be public" },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path.join(".")).toBe("blocks.0.elements.0.headline.default");
  });

  test("preserves arbitrary metadata while normalizing known translatable metadata fields", () => {
    const parsed = ZV3CreateSurveyBody.parse({
      ...validCreateBody,
      metadata: {
        cx_context: {
          "de-DE": "This is arbitrary customer metadata, not translation content",
        },
        title: {
          "en-US": "Feedback Survey",
          "de-DE": "Feedback-Umfrage",
        },
      },
    });

    expect(parsed.metadata).toMatchObject({
      cx_context: {
        "de-DE": "This is arbitrary customer metadata, not translation content",
      },
      title: {
        default: "Feedback Survey",
        "de-DE": "Feedback-Umfrage",
      },
    });
  });

  test("rejects non-link survey types for this survey-template endpoint", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "app",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["type"]);
  });

  test("rejects malformed locale maps that do not include the default language", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              ...validCreateBody.blocks[0].elements[0],
              headline: { "not a locale": "Hello" },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  test("reports missing required element fields before shared element union errors", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      blocks: [
        {
          ...validCreateBody.blocks[0],
          elements: [
            {
              id: "feedback",
              type: "openText",
              headline: { "en-US": "Tell us more" },
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.required",
            reason: "Missing required field 'required' for element type 'openText'",
            code: "missing_required_field",
          }),
        ])
      );
    }
  });

  test("rejects duplicate language entries and disabled default language", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      languages: [{ code: "en-US", enabled: false }, { code: "en_us" }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["languages.0.enabled", "languages.1.code"])
    );
  });
});

describe("ZV3PatchSurveyBody", () => {
  test("accepts a strict top-level partial and preserves omitted defaults", () => {
    const parsed = ZV3PatchSurveyBody.parse({
      name: "Updated survey",
    });

    expect(parsed).toEqual({ name: "Updated survey" });
  });

  test("rejects an empty patch body", () => {
    const result = ZV3PatchSurveyBody.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "Request body must include at least one updatable field",
    });
  });

  test("rejects immutable and out-of-scope fields", () => {
    const result = ZV3PatchSurveyBody.safeParse({
      id: "clsv1234567890123456789012",
      workspaceId: "clxx1234567890123456789012",
      type: "link",
      questions: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["id", "workspaceId", "type", "questions"])
    );
  });

  test("normalizes patch translation maps using the current default language", () => {
    const parsed = createZV3PatchSurveyBodySchema("de-DE").parse({
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { de_de: "Hallo", en_us: "Hello" },
              required: true,
            },
          ],
        },
      ],
    });

    expect(parsed.blocks?.[0].elements[0]).toMatchObject({
      headline: { default: "Hallo", "en-US": "Hello" },
    });
    expect(parsed).not.toHaveProperty("defaultLanguage");
  });

  test("does not generate missing ids for canonical patch documents", () => {
    const result = ZV3PatchSurveyBody.safeParse({
      blocks: [
        {
          name: "Missing ID Block",
          elements: validCreateBody.blocks[0].elements,
        },
      ],
      variables: [
        {
          name: "score",
          type: "number",
          value: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["blocks.0.id", "variables.0.id"])
    );
  });
});
