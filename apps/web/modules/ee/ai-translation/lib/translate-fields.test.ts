import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TAITranslationField, translateFields } from "./translate-fields";

vi.mock("server-only", () => ({}));

const mockGenerateOrganizationAIObject = vi.fn();
vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: (...args: unknown[]) => mockGenerateOrganizationAIObject(...args),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const baseInput = {
  organizationId: "org-1",
  sourceLanguage: "English",
  targetLanguage: "German",
};

const fields: TAITranslationField[] = [
  { path: "welcomeCard.headline.default", defaultText: "Welcome", isRichText: false },
  { path: "questions.0.html.default", defaultText: "<p>Hello</p>", isRichText: true },
];

describe("translateFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns translations keyed by original field paths", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { t0: "Willkommen", t1: "<p>Hallo</p>" },
    });

    const result = await translateFields({ ...baseInput, fields });

    expect(result).toEqual({
      "welcomeCard.headline.default": "Willkommen",
      "questions.0.html.default": "<p>Hallo</p>",
    });
  });

  test("sends opaque indexed IDs to the model, never the field paths", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { t0: "Willkommen", t1: "<p>Hallo</p>" },
    });

    await translateFields({ ...baseInput, fields });

    expect(mockGenerateOrganizationAIObject).toHaveBeenCalledTimes(1);
    const callArg = mockGenerateOrganizationAIObject.mock.calls[0][0];
    expect(callArg.prompt).not.toContain("welcomeCard.headline.default");
    expect(callArg.prompt).not.toContain("questions.0.html.default");
    const userPayload = JSON.parse(callArg.prompt);
    expect(userPayload).toEqual([
      { id: "t0", text: "Welcome", richText: false },
      { id: "t1", text: "<p>Hello</p>", richText: true },
    ]);
  });

  test("requests deterministic output (temperature: 0) for stable translations", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { t0: "Willkommen", t1: "<p>Hallo</p>" },
    });

    await translateFields({ ...baseInput, fields });

    expect(mockGenerateOrganizationAIObject.mock.calls[0][0].temperature).toBe(0);
  });

  test("returns empty object without calling the model when no fields are provided", async () => {
    const result = await translateFields({ ...baseInput, fields: [] });

    expect(result).toEqual({});
    expect(mockGenerateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("throws when the model omits any requested ID from the response", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { t0: "Willkommen" }, // t1 missing
    });

    await expect(translateFields({ ...baseInput, fields })).rejects.toThrow(
      "AI translation returned incomplete result"
    );
  });

  test("throws when the model returns an empty string for any ID", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { t0: "Willkommen", t1: "" }, // empty string treated as missing
    });

    await expect(translateFields({ ...baseInput, fields })).rejects.toThrow(
      "AI translation returned incomplete result"
    );
  });

  test("propagates errors thrown by the AI provider", async () => {
    mockGenerateOrganizationAIObject.mockRejectedValue(new Error("provider failed"));

    await expect(translateFields({ ...baseInput, fields })).rejects.toThrow("provider failed");
  });

  test("echoes empty defaultText through without calling the model", async () => {
    const allEmpty: TAITranslationField[] = [
      { path: "welcomeCard.subheader.default", defaultText: "", isRichText: false },
      { path: "endings.0.subheader.default", defaultText: "", isRichText: false },
    ];

    const result = await translateFields({ ...baseInput, fields: allEmpty });

    expect(result).toEqual({
      "welcomeCard.subheader.default": "",
      "endings.0.subheader.default": "",
    });
    expect(mockGenerateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("translates non-empty fields and echoes empty ones in the same call", async () => {
    const mixed: TAITranslationField[] = [
      { path: "welcomeCard.headline.default", defaultText: "Welcome", isRichText: false },
      { path: "welcomeCard.subheader.default", defaultText: "", isRichText: false },
      { path: "questions.0.headline.default", defaultText: "How are you?", isRichText: false },
    ];

    // Empty fields are filtered out before indexing, so the model only sees
    // the two non-empty entries as t0 and t1.
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { t0: "Willkommen", t1: "Wie geht es dir?" },
    });

    const result = await translateFields({ ...baseInput, fields: mixed });

    expect(result).toEqual({
      "welcomeCard.headline.default": "Willkommen",
      "welcomeCard.subheader.default": "",
      "questions.0.headline.default": "Wie geht es dir?",
    });

    // Confirm the model never saw the empty field in the payload.
    const callArg = mockGenerateOrganizationAIObject.mock.calls[0][0];
    const userPayload = JSON.parse(callArg.prompt);
    expect(userPayload).toEqual([
      { id: "t0", text: "Welcome", richText: false },
      { id: "t1", text: "How are you?", richText: false },
    ]);
  });
});
