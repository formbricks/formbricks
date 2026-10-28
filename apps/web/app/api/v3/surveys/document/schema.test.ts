import { describe, expect, test, vi } from "vitest";
import {
  canonicalizeV3SurveyDocument,
  parseV3SurveyDocument,
  toV3SurveyDocument,
  toV3SurveyPatchInput,
} from "./schema";

vi.mock("server-only", () => ({}));

const blocks = [{ id: "clbk1234567890123456789012", name: "Main", elements: [] }];

describe("parseV3SurveyDocument", () => {
  test("accepts a document with only the keys that have no empty value", () => {
    expect(parseV3SurveyDocument({ name: "  Survey ", blocks })).toEqual({
      ok: true,
      document: { name: "Survey", blocks },
    });
  });

  test("names every unknown key, with the reason when the key belongs to the resource", () => {
    const result = parseV3SurveyDocument({
      name: "S",
      blocks,
      status: "inProgress",
      defaultLanguage: "en-US",
      bogus: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalidParams.map(({ name, code }) => [name, code])).toEqual([
      ["status", "unsupported_field"],
      ["defaultLanguage", "unsupported_field"],
      ["bogus", "unsupported_field"],
    ]);
    expect(result.invalidParams[0].reason).toMatch(/never publishes/);
    expect(result.invalidParams[2].reason).not.toMatch(/: a push|: it is/);
  });

  test("leaves the entries inside a key, such as a language alias, to the patch pipeline", () => {
    const result = parseV3SurveyDocument({ name: "S", blocks, languages: [{ code: "en-US" }] });
    expect(result.ok).toBe(true);
  });

  test("reports a missing name and missing blocks together", () => {
    const result = parseV3SurveyDocument({});
    expect(result).toEqual({
      ok: false,
      invalidParams: [
        expect.objectContaining({ name: "name", code: "missing_required_field" }),
        expect.objectContaining({ name: "blocks", code: "missing_required_field" }),
      ],
    });
  });

  test("refuses a document that is not an object and a wrongly typed key", () => {
    expect(parseV3SurveyDocument([])).toMatchObject({ ok: false });
    expect(parseV3SurveyDocument({ name: "S", blocks: "x" })).toMatchObject({
      ok: false,
      invalidParams: [expect.objectContaining({ name: "blocks" })],
    });
    expect(parseV3SurveyDocument({ name: "S", blocks: [] })).toMatchObject({ ok: false });
  });
});

describe("toV3SurveyPatchInput", () => {
  test("sends every editable key, resetting the ones the document leaves out (link survey)", () => {
    const input = toV3SurveyPatchInput({ name: "S", blocks }, "link");

    expect(input).toEqual({
      name: "S",
      metadata: {},
      languages: [],
      showLanguageSwitch: null,
      autoSelectLanguage: null,
      welcomeCard: { enabled: false },
      blocks,
      endings: [],
      hiddenFields: { enabled: false },
      variables: [],
      customCss: null,
    });
    expect(input).not.toHaveProperty("status");
  });

  test("an app survey also resets distribution and targeting", () => {
    const input = toV3SurveyPatchInput({ name: "S", blocks }, "app");

    expect(input.distribution).toEqual({});
    expect(input.targeting).toEqual({ filters: [] });
  });

  test("keeps a distribution sent for a link survey so the patch pipeline can refuse it", () => {
    const input = toV3SurveyPatchInput({ name: "S", blocks, distribution: { delay: 1 } }, "link");

    expect(input.distribution).toEqual({ delay: 1 });
    expect(input).not.toHaveProperty("targeting");
  });

  test("keeps what the document sends", () => {
    const input = toV3SurveyPatchInput(
      {
        name: "S",
        blocks,
        endings: [{ id: "e" }],
        showLanguageSwitch: true,
        customCss: { light: "a", dark: null },
      },
      "link"
    );

    expect(input).toMatchObject({
      endings: [{ id: "e" }],
      showLanguageSwitch: true,
      customCss: { light: "a", dark: null },
    });
  });
});

describe("toV3SurveyDocument", () => {
  const resource = {
    id: "s1",
    workspaceId: "w1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    name: "S",
    type: "link",
    status: "inProgress",
    archivedAt: null,
    access: "owner",
    owner: null,
    visibility: "workspace",
    metadata: {},
    defaultLanguage: "en-US",
    languages: [{ code: "en-US", default: true, enabled: true, alias: "english" }],
    showLanguageSwitch: null,
    autoSelectLanguage: null,
    welcomeCard: { enabled: false },
    blocks,
    endings: [],
    hiddenFields: { enabled: false },
    variables: [],
    customCss: null,
  } as unknown as Parameters<typeof toV3SurveyDocument>[0];

  test("leaves out identity, lifecycle, per-caller fields and the language alias", () => {
    const document = toV3SurveyDocument(resource);

    for (const key of [
      "id",
      "workspaceId",
      "createdAt",
      "updatedAt",
      "type",
      "status",
      "archivedAt",
      "access",
      "owner",
      "visibility",
      "defaultLanguage",
    ]) {
      expect(document).not.toHaveProperty(key);
    }
    expect(document.languages).toEqual([{ code: "en-US", default: true, enabled: true }]);
    // A link survey has neither.
    expect(document).not.toHaveProperty("distribution");
    expect(document).not.toHaveProperty("targeting");
  });

  test("carries distribution and targeting of an app survey", () => {
    const document = toV3SurveyDocument({
      ...resource,
      distribution: { delay: 0 },
      targeting: { filters: [] },
    } as unknown as Parameters<typeof toV3SurveyDocument>[0]);

    expect(document).toMatchObject({ distribution: { delay: 0 }, targeting: { filters: [] } });
  });

  test("a pulled document is a valid document that resets nothing it carries", () => {
    const document = toV3SurveyDocument(resource);
    const parsed = parseV3SurveyDocument(document);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toV3SurveyPatchInput(parsed.document, "link")).toEqual(document);
  });
});

describe("canonicalizeV3SurveyDocument", () => {
  test("makes key order irrelevant, and array order relevant", () => {
    expect(JSON.stringify(canonicalizeV3SurveyDocument({ b: 1, a: { d: 1, c: 2 } }))).toBe(
      JSON.stringify(canonicalizeV3SurveyDocument({ a: { c: 2, d: 1 }, b: 1 }))
    );
    expect(JSON.stringify(canonicalizeV3SurveyDocument([1, 2]))).not.toBe(
      JSON.stringify(canonicalizeV3SurveyDocument([2, 1]))
    );
  });
});
