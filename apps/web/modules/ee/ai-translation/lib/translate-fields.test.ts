import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TAITranslationField, translateFields } from "./translate-fields";

vi.mock("server-only", () => ({}));

const mockGenerateOrganizationAIText = vi.fn();
vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIText: (...args: unknown[]) => mockGenerateOrganizationAIText(...args),
}));

const baseInput = {
  organizationId: "org-1",
  sourceLanguage: "English",
  targetLanguage: "German",
};

const fields: TAITranslationField[] = [
  { path: "headline", defaultText: "Welcome", isRichText: false },
  { path: "description", defaultText: "<p>Hello</p>", isRichText: true },
];

describe("translateFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns translated fields from clean JSON response", async () => {
    mockGenerateOrganizationAIText.mockResolvedValue({
      text: JSON.stringify({ headline: "Willkommen", description: "<p>Hallo</p>" }),
    });

    const result = await translateFields({ ...baseInput, fields });
    expect(result).toEqual({ headline: "Willkommen", description: "<p>Hallo</p>" });
  });

  test("strips markdown code fences", async () => {
    mockGenerateOrganizationAIText.mockResolvedValue({
      text: '```json\n{"headline": "Willkommen"}\n```',
    });

    const result = await translateFields({ ...baseInput, fields });
    expect(result).toEqual({ headline: "Willkommen" });
  });

  test("extracts JSON from wrapper text", async () => {
    mockGenerateOrganizationAIText.mockResolvedValue({
      text: 'Here is the translation:\n{"headline": "Willkommen"}\nHope this helps!',
    });

    const result = await translateFields({ ...baseInput, fields });
    expect(result).toEqual({ headline: "Willkommen" });
  });

  test("filters out unrequested keys and non-string values", async () => {
    mockGenerateOrganizationAIText.mockResolvedValue({
      text: JSON.stringify({ headline: "Willkommen", extra: "Nein", description: 42 }),
    });

    const result = await translateFields({ ...baseInput, fields });
    expect(result).toEqual({ headline: "Willkommen" });
  });

  test("throws on unparseable response", async () => {
    mockGenerateOrganizationAIText.mockResolvedValue({ text: "not json at all" });

    await expect(translateFields({ ...baseInput, fields })).rejects.toThrow(
      "Failed to parse AI translation response"
    );
  });
});
