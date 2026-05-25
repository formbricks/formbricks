import { describe, expect, test, vi } from "vitest";
import { deriveV3SurveyLanguageRequests } from "./languages";
import { ZV3CreateSurveyBody } from "./schemas";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    language: {
      upsert: vi.fn(),
    },
  },
}));

describe("deriveV3SurveyLanguageRequests", () => {
  test("derives languages from defaultLanguage and declared languages only", () => {
    const document = ZV3CreateSurveyBody.parse({
      workspaceId: "clxx1234567890123456789012",
      name: "Product Feedback",
      defaultLanguage: "en-US",
      languages: [{ code: "pt-BR" }],
      metadata: {
        title: {
          "en-US": "Feedback",
          "de-DE": "Feedback",
        },
        cx_context: {
          "fr-FR": "Arbitrary customer metadata, not translatable survey text",
        },
      },
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: {
                "en-US": "What should we improve?",
                "pt-BR": "O que devemos melhorar?",
              },
              required: true,
            },
          ],
        },
      ],
    });

    expect(deriveV3SurveyLanguageRequests(document)).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "pt-BR", default: false, enabled: true },
    ]);
  });
});
