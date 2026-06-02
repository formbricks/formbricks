import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TAITranslationField, translateFields } from "./translate-fields";

vi.mock("server-only", () => ({}));

const mockGenerateOrganizationAIObject = vi.fn();
vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: (...args: unknown[]) => mockGenerateOrganizationAIObject(...args),
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

  test("returns translated fields from structured response", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { translations: { headline: "Willkommen", description: "<p>Hallo</p>" } },
    });

    const result = await translateFields({ ...baseInput, fields });
    expect(result).toEqual({ headline: "Willkommen", description: "<p>Hallo</p>" });
  });

  test("filters out unrequested keys", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { translations: { headline: "Willkommen", extra: "Nein" } },
    });

    const result = await translateFields({ ...baseInput, fields });
    expect(result).toEqual({ headline: "Willkommen" });
  });

  test("throws when no key matches the requested fields", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { translations: { unrelatedKey: "Etwas" } },
    });

    await expect(translateFields({ ...baseInput, fields })).rejects.toThrow(
      "AI translation response had no usable translations"
    );
  });

  test("passes a schema and explicit prompt to the AI helper", async () => {
    mockGenerateOrganizationAIObject.mockResolvedValue({
      object: { translations: { headline: "Willkommen" } },
    });

    await translateFields({ ...baseInput, fields });

    const call = mockGenerateOrganizationAIObject.mock.calls[0][0];
    expect(call.organizationId).toBe("org-1");
    expect(call.schema).toBeDefined();
    expect(call.system).toContain("EXACTLY");
    expect(call.system).toContain("translations");
    // Each input item's path must be in the serialized prompt.
    expect(call.prompt).toContain('"key":"headline"');
    expect(call.prompt).toContain('"key":"description"');
  });
});
