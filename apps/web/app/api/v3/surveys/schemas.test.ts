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
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "defaultLanguage",
            reason: "Language 'not a locale' is not a valid locale code",
            code: "invalid_locale",
          }),
        ])
      );
    }
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
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.headline.en_us",
            reason: "Language key 'en_us' duplicates 'en-US' after locale normalization",
            code: "duplicate_locale",
          }),
        ])
      );
    }
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

  test("accepts link and app survey types for the public create endpoint", () => {
    expect(ZV3CreateSurveyBody.parse(validCreateBody).type).toBe("link");

    const result = ZV3CreateSurveyBody.parse({
      ...validCreateBody,
      type: "app",
    });

    expect(result.type).toBe("app");
  });

  test("accepts an app survey with distribution + targeting and applies distribution defaults", () => {
    const result = ZV3CreateSurveyBody.parse({
      ...validCreateBody,
      type: "app",
      distribution: {
        displayOption: "respondMultiple",
        recontactDays: 7,
        triggers: [{ actionClassId: "claa1234567890123456789012" }],
      },
      targeting: { filters: [] },
    });

    expect(result.distribution).toMatchObject({
      displayOption: "respondMultiple",
      recontactDays: 7,
      displayPercentage: null,
      displayLimit: null,
      autoClose: null,
      autoComplete: null,
      delay: 0,
      triggers: [{ actionClassId: "claa1234567890123456789012" }],
    });
    expect(result.targeting).toEqual({ filters: [] });
  });

  test("rejects distribution and targeting on link surveys", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "link",
      distribution: { displayOption: "displayOnce" },
      targeting: { filters: [] },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "distribution", code: "unsupported_field" }),
          expect.objectContaining({ name: "targeting", code: "unsupported_field" }),
        ])
      );
    }
  });

  test("requires displayLimit >= 1 when displayOption is displaySome", () => {
    const noLimit = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "app",
      distribution: { displayOption: "displaySome" },
    });
    expect(noLimit.success).toBe(false);
    if (!noLimit.success) {
      expect(formatV3ZodInvalidParams(noLimit.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "distribution.displayLimit",
            code: "missing_required_field",
          }),
        ])
      );
    }

    const zeroLimit = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "app",
      distribution: { displayOption: "displaySome", displayLimit: 0 },
    });
    expect(zeroLimit.success).toBe(false);
  });

  test("accepts displayPercentage with any displayOption (independent throttle)", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "app",
      distribution: { displayOption: "displayOnce", displayPercentage: 50 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distribution).toMatchObject({ displayOption: "displayOnce", displayPercentage: 50 });
    }
  });

  test("rejects unsupported fields inside distribution", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "app",
      distribution: { displayOption: "displayOnce", surprise: true },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "distribution.surprise", code: "unsupported_field" }),
        ])
      );
    }
  });

  test("rejects a malformed trigger action class id", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      type: "app",
      distribution: { triggers: [{ actionClassId: "not-a-cuid" }] },
    });

    expect(result.success).toBe(false);
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
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "blocks.0.elements.0.headline.not a locale",
            reason: "Language key 'not a locale' is not a valid locale code",
            code: "invalid_locale",
          }),
        ])
      );
    }
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

  test("reports missing required ending fields before shared ending union errors", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      endings: [
        {
          type: "endScreen",
          headline: { "en-US": "Thanks!" },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "endings.0.id",
            reason: "Missing required field 'id' for ending type 'endScreen'",
            code: "missing_required_field",
          }),
        ])
      );
    }
  });

  test("reports missing ending type with a precise invalid param path", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      endings: [
        {
          id: "clend123456789012345678901",
          headline: { "en-US": "Thanks!" },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "endings.0.type",
            reason: "Missing required field 'type' for survey ending",
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
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "languages.0.enabled",
            reason: "The default language cannot be disabled",
          }),
          expect.objectContaining({
            name: "languages.1.code",
            reason: "Language 'en-US' is duplicated",
            code: "duplicate_locale",
          }),
        ])
      );
    }
  });

  test("reports invalid language entries with machine-readable locale metadata", () => {
    const result = ZV3CreateSurveyBody.safeParse({
      ...validCreateBody,
      languages: [{ code: "de", enabled: true }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "languages.0.code",
            reason: "Language 'de' is not a valid locale code",
            code: "invalid_locale",
          }),
        ])
      );
    }
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
      defaultLanguage: "de-DE",
      questions: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["id", "workspaceId", "type", "defaultLanguage", "questions"])
    );
  });

  test("rejects patch languages that mark a non-current locale as default", () => {
    const result = createZV3PatchSurveyBodySchema("en-US").safeParse({
      languages: [{ code: "de-DE", default: true, enabled: true }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "The default language entry must match defaultLanguage",
      path: ["languages", 0, "default"],
    });
  });

  test("accepts patch languages that keep the current default locale", () => {
    const parsed = createZV3PatchSurveyBodySchema("en-US").parse({
      languages: [
        { code: "en_us", default: true, enabled: true },
        { code: "de-DE", enabled: false },
      ],
    });

    expect(parsed.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", enabled: false },
    ]);
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

  test("allows existing legacy language codes only through the patch compatibility context", () => {
    const parsed = createZV3PatchSurveyBodySchema("gu", {
      allowedLanguageCodes: ["gu"],
    }).parse({
      metadata: {
        title: { gu: "Legacy Gujarati survey" },
      },
      languages: [{ code: "gu", default: true, enabled: true }],
    });

    expect(parsed).toMatchObject({
      metadata: { title: { default: "Legacy Gujarati survey" } },
      languages: [{ code: "gu", default: true, enabled: true }],
    });
  });

  test("rejects newly introduced non-canonical patch languages without compatibility context", () => {
    const result = createZV3PatchSurveyBodySchema("en-US", {
      allowedLanguageCodes: ["en-US"],
    }).safeParse({
      languages: [{ code: "gu", enabled: true }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "Language 'gu' is not a valid locale code",
      path: ["languages", 0, "code"],
    });
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

  test("rejects distribution and targeting when patching a link survey", () => {
    const result = createZV3PatchSurveyBodySchema("en-US", undefined, "link").safeParse({
      distribution: { displayOption: "displayOnce" },
      targeting: { filters: [] },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatV3ZodInvalidParams(result.error, "body")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "distribution", code: "unsupported_field" }),
          expect.objectContaining({ name: "targeting", code: "unsupported_field" }),
        ])
      );
    }
  });

  test("accepts distribution and targeting when patching an app survey", () => {
    const parsed = createZV3PatchSurveyBodySchema("en-US", undefined, "app").parse({
      distribution: { displayOption: "displayMultiple" },
      targeting: { filters: [] },
    });

    expect(parsed.distribution).toMatchObject({ displayOption: "displayMultiple" });
    expect(parsed.targeting).toEqual({ filters: [] });
  });
});
