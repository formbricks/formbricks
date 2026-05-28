import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { prepareV3SurveyCreateInput } from "../prepare";
import {
  V3SurveyGeneratePromptError,
  V3SurveyGeneratedPayloadValidationError,
  generateV3SurveyCreatePayloadFromPrompt,
} from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";

const generateInput = {
  workspaceId,
  type: "link" as const,
  prompt: "Create a customer onboarding feedback survey for new SaaS users.",
};

describe("generateV3SurveyCreatePayloadFromPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects underspecified prompts before calling the AI provider", async () => {
    await expect(
      generateV3SurveyCreatePayloadFromPrompt({
        organizationId: "org_1",
        input: {
          workspaceId,
          type: "link",
          prompt: "Feedback",
        },
      })
    ).rejects.toThrow(V3SurveyGeneratePromptError);

    expect(generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("returns a validated draft v3 create payload", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        name: "Onboarding Feedback",
        description: "Understand the first-run onboarding experience.",
        welcomeCard: {
          enabled: true,
          headline: "Help us improve onboarding",
          subheader: "This takes about two minutes.",
        },
        blocks: [
          {
            name: "Onboarding experience",
            questions: [
              {
                type: "multipleChoiceSingle",
                headline: "How easy was it to get started?",
                subheader: null,
                required: true,
                placeholder: null,
                longAnswer: null,
                choices: ["Very easy", "Somewhat easy", "Difficult"],
                lowerLabel: null,
                upperLabel: null,
                scale: null,
                range: null,
              },
              {
                type: "openText",
                headline: "What was confusing or missing?",
                subheader: null,
                required: false,
                placeholder: null,
                longAnswer: true,
                choices: null,
                lowerLabel: null,
                upperLabel: null,
                scale: null,
                range: null,
              },
            ],
          },
        ],
        ending: {
          headline: "Thanks for helping us improve",
          subheader: null,
        },
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: generateInput,
    });

    expect(generateOrganizationAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        schemaName: "FormbricksSurveyDraft",
        temperature: 0.2,
      })
    );
    expect(result.payload).toMatchObject({
      workspaceId,
      type: "link",
      name: "Onboarding Feedback",
      status: "draft",
      defaultLanguage: "en-US",
      welcomeCard: {
        enabled: true,
        headline: { "en-US": "Help us improve onboarding" },
      },
    });
    expect(result.payload.welcomeCard?.headline).not.toHaveProperty("default");
    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(result.payload.blocks).toHaveLength(1);
    expect(result.payload.blocks[0].name).toBe("Onboarding experience");
    expect(result.payload.blocks[0].elements).toHaveLength(2);
    expect(result.payload.endings).toHaveLength(1);
    expect(result.validation).toEqual({
      valid: true,
      invalid_params: [],
      languages: [{ code: "en-US", default: true, enabled: true }],
    });
  });

  test("maps generated blocks to separate v3 create blocks", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        name: "Product-Market Fit Survey",
        description: "Measure fit and learn what users value most.",
        welcomeCard: {
          enabled: false,
          headline: null,
          subheader: null,
        },
        blocks: [
          {
            name: "Usage context",
            questions: [
              {
                type: "multipleChoiceSingle",
                headline: "How often do you use the product?",
                subheader: null,
                required: true,
                placeholder: null,
                longAnswer: null,
                choices: ["Daily", "Weekly", "Monthly", "Rarely"],
                lowerLabel: null,
                upperLabel: null,
                scale: null,
                range: null,
              },
            ],
          },
          {
            name: "Product-market fit",
            questions: [
              {
                type: "multipleChoiceSingle",
                headline: "How would you feel if you could no longer use the product?",
                subheader: null,
                required: true,
                placeholder: null,
                longAnswer: null,
                choices: ["Very disappointed", "Somewhat disappointed", "Not disappointed"],
                lowerLabel: null,
                upperLabel: null,
                scale: null,
                range: null,
              },
            ],
          },
          {
            name: "Open feedback",
            questions: [
              {
                type: "openText",
                headline: "What would you miss most?",
                subheader: null,
                required: false,
                placeholder: "Share the features, workflows, or outcomes you rely on",
                longAnswer: true,
                choices: null,
                lowerLabel: null,
                upperLabel: null,
                scale: null,
                range: null,
              },
            ],
          },
        ],
        ending: {
          headline: "Thanks for your feedback",
          subheader: null,
        },
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: {
        ...generateInput,
        prompt:
          "Create a product-market-fit survey with separate blocks for usage context, product-market-fit score, and open-ended feedback.",
      },
    });

    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(result.payload.blocks).toHaveLength(3);
    expect(result.payload.blocks.map((block) => block.name)).toEqual([
      "Usage context",
      "Product-market fit",
      "Open feedback",
    ]);
    expect(
      result.payload.blocks.flatMap((block) => block.elements.map((element) => element.id))
    ).toHaveLength(3);
  });

  test("surfaces invalid generated objects as validation failures", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        name: "Broken survey",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Broken block",
            questions: [
              {
                type: "multipleChoiceSingle",
                headline: "Pick one",
                subheader: null,
                required: false,
                placeholder: null,
                longAnswer: null,
                choices: ["Only one"],
                lowerLabel: null,
                upperLabel: null,
                scale: null,
                range: null,
              },
            ],
          },
        ],
        ending: null,
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    await expect(
      generateV3SurveyCreatePayloadFromPrompt({
        organizationId: "org_1",
        input: generateInput,
      })
    ).rejects.toThrow(V3SurveyGeneratedPayloadValidationError);
  });
});
