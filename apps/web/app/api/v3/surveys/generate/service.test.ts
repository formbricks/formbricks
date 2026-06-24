import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { prepareV3SurveyCreateInput } from "../prepare";
import { V3_SURVEY_GENERATE_ALLOWED_LOCALES, ZGeneratedSurveyDraftForAI } from "./schemas";
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

interface GeneratedElementOverrides {
  type: string;
  headline: string;
  subheader?: string | null;
  required?: boolean;
  placeholder?: string | null;
  longAnswer?: boolean | null;
  choices?: string[] | null;
  rows?: string[] | null;
  columns?: string[] | null;
  lowerLabel?: string | null;
  upperLabel?: string | null;
  scale?: "number" | "smiley" | "star" | null;
  range?: string | null;
  format?: "M-d-y" | "d-M-y" | "y-M-d" | null;
}

function generatedElement(overrides: GeneratedElementOverrides) {
  return {
    subheader: null,
    required: false,
    placeholder: null,
    longAnswer: null,
    choices: null,
    rows: null,
    columns: null,
    lowerLabel: null,
    upperLabel: null,
    scale: null,
    range: null,
    format: null,
    ...overrides,
  };
}

describe("generateV3SurveyCreatePayloadFromPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("formats generated payload validation errors without invalid params", () => {
    expect(new V3SurveyGeneratedPayloadValidationError([]).message).toBe(
      "Generated survey payload is invalid"
    );
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

    await expect(
      generateV3SurveyCreatePayloadFromPrompt({
        organizationId: "org_1",
        input: {
          workspaceId,
          type: "link",
          prompt: "Onboarding feedback survey",
        },
      })
    ).rejects.toThrow(V3SurveyGeneratePromptError);

    expect(generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("returns a validated draft v3 create payload", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Onboarding Feedback",
        description: "Understand the first-run onboarding experience.",
        welcomeCard: {
          enabled: true,
          headline: "Help us improve onboarding",
          subheader: "This takes about two minutes.",
          buttonLabel: "Start",
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
        schema: ZGeneratedSurveyDraftForAI,
        schemaName: "FormbricksSurveyDraft",
        temperature: 0.2,
        timeout: 45_000,
      })
    );
    const generationOptions = vi.mocked(generateOrganizationAIObject).mock.calls[0][0];
    expect(generationOptions.system).toContain(
      `Allowed survey languages: ${V3_SURVEY_GENERATE_ALLOWED_LOCALES.join(", ")}`
    );
    expect(generationOptions.system).toContain("link survey draft");
    expect(generationOptions.prompt).toContain(
      `Allowed survey languages: ${V3_SURVEY_GENERATE_ALLOWED_LOCALES.join(", ")}`
    );
    expect(generationOptions.prompt).toContain("Create a draft link survey");
    expect(result.payload).toMatchObject({
      workspaceId,
      type: "link",
      name: "Onboarding Feedback",
      status: "draft",
      defaultLanguage: "en-US",
      languages: [{ code: "en-US", default: true, enabled: true }],
      welcomeCard: {
        enabled: true,
        headline: { "en-US": "Help us improve onboarding" },
      },
    });
    expect(result.language).toBe("en-US");
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

  test("seeds a default app distribution when generating an app survey", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "In-App Onboarding Feedback",
        description: null,
        welcomeCard: { enabled: false, headline: null, subheader: null, buttonLabel: null },
        blocks: [
          {
            name: "Onboarding",
            questions: [
              {
                type: "openText",
                headline: "How was your setup experience?",
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
        ending: { headline: "Thanks for the feedback", subheader: null },
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: {
        workspaceId,
        type: "app",
        prompt: "Create an in-app onboarding feedback survey for brand new users.",
      },
    });

    const generationOptions = vi.mocked(generateOrganizationAIObject).mock.calls[0][0];
    expect(generationOptions.system).toContain("app survey draft");

    expect(result.payload.type).toBe("app");
    expect(result.payload.distribution).toMatchObject({ displayOption: "displayOnce", triggers: [] });
    expect(result.payload).not.toHaveProperty("targeting");
    expect(result.validation.valid).toBe(true);
    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
  });

  test("maps generated blocks to separate v3 create blocks", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Product-Market Fit Survey",
        description: "Measure fit and learn what users value most.",
        welcomeCard: {
          enabled: false,
          headline: null,
          subheader: null,
          buttonLabel: null,
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

  test("normalizes rating-like questions into single-question blocks while preserving order", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Mixed Feedback Survey",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Mixed feedback",
            questions: [
              generatedElement({
                type: "openText",
                headline: "What should we improve first?",
                longAnswer: true,
              }),
              generatedElement({
                type: "multipleChoiceSingle",
                headline: "Which user role best describes you?",
                choices: ["Admin", "Builder", "Viewer"],
              }),
              generatedElement({
                type: "rating",
                headline: "How would you rate onboarding?",
                scale: "number",
                range: "5",
              }),
              generatedElement({
                type: "csat",
                headline: "How satisfied are you overall?",
                scale: "number",
                range: "5",
              }),
            ],
          },
          {
            name: "Mixed feedback",
            questions: [
              generatedElement({
                type: "openText",
                headline: "What was confusing?",
                longAnswer: true,
              }),
              generatedElement({
                type: "multipleChoiceMulti",
                headline: "Which areas need attention?",
                choices: ["Docs", "Setup", "Support"],
              }),
              generatedElement({
                type: "nps",
                headline: "How likely are you to recommend us?",
              }),
            ],
          },
        ],
        ending: null,
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: generateInput,
    });

    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(result.payload.blocks.map((block) => block.name)).toEqual([
      "Mixed feedback",
      "How would you rate onboarding?",
      "How satisfied are you overall?",
      "Mixed feedback",
      "How likely are you to recommend us?",
    ]);
    expect(result.payload.blocks.map((block) => block.elements.map((element) => element.type))).toEqual([
      ["openText", "multipleChoiceSingle"],
      ["rating"],
      ["csat"],
      ["openText", "multipleChoiceMulti"],
      ["nps"],
    ]);
  });

  test("splits every rating-like question in the same AI block into separate blocks", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Score Survey",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Scores",
            questions: [
              generatedElement({
                type: "ces",
                headline: "How easy was setup?",
                scale: "number",
                range: "7",
              }),
              generatedElement({
                type: "matrix",
                headline: "Rate each setup area.",
                rows: ["Docs", "Import"],
                columns: ["Poor", "Good", "Great"],
              }),
              generatedElement({
                type: "ranking",
                headline: "Rank the improvements.",
                choices: ["Guidance", "Speed", "Integrations"],
              }),
            ],
          },
        ],
        ending: null,
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: generateInput,
    });

    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(result.payload.blocks.map((block) => block.name)).toEqual([
      "How easy was setup?",
      "Rate each setup area.",
      "Rank the improvements.",
    ]);
    expect(result.payload.blocks.map((block) => block.elements.map((element) => element.type))).toEqual([
      ["ces"],
      ["matrix"],
      ["ranking"],
    ]);
  });

  test("keeps repeated non-rating questions grouped in their original block", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Open Feedback Survey",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Open feedback",
            questions: [
              generatedElement({
                type: "openText",
                headline: "What worked well?",
                longAnswer: true,
              }),
              generatedElement({
                type: "openText",
                headline: "What should we improve?",
                longAnswer: true,
              }),
              generatedElement({
                type: "multipleChoiceSingle",
                headline: "Which plan are you on?",
                choices: ["Free", "Pro", "Enterprise"],
              }),
              generatedElement({
                type: "multipleChoiceSingle",
                headline: "How often do you use the product?",
                choices: ["Daily", "Weekly", "Monthly"],
              }),
            ],
          },
        ],
        ending: null,
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: generateInput,
    });

    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(result.payload.blocks).toHaveLength(1);
    expect(result.payload.blocks[0].name).toBe("Open feedback");
    expect(result.payload.blocks[0].elements.map((element) => element.type)).toEqual([
      "openText",
      "openText",
      "multipleChoiceSingle",
      "multipleChoiceSingle",
    ]);
  });

  test("maps supported generated question types to v3 create elements", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Customer Signal Survey",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Scores",
            questions: [
              generatedElement({
                type: "csat",
                headline: "How satisfied are you with the onboarding experience?",
                subheader: "Think about the first setup session.",
                lowerLabel: "Very dissatisfied",
                upperLabel: "Very satisfied",
                scale: "number",
                range: "5",
              }),
              generatedElement({
                type: "ces",
                headline: "How easy was it to complete setup?",
                scale: "number",
                range: "7",
              }),
              generatedElement({
                type: "ranking",
                headline: "Rank the improvements that matter most.",
                choices: ["Speed", "Guidance", "Integrations"],
              }),
            ],
          },
          {
            name: "Detailed feedback",
            questions: [
              generatedElement({
                type: "matrix",
                headline: "Rate each part of the onboarding experience.",
                rows: ["Setup", "Activation"],
                columns: ["Poor", "Good", "Excellent"],
              }),
              generatedElement({
                type: "date",
                headline: "When did you complete onboarding?",
              }),
              generatedElement({
                type: "nps",
                headline: "How likely are you to recommend us?",
                lowerLabel: "Not likely",
                upperLabel: "Very likely",
              }),
              generatedElement({
                type: "rating",
                headline: "How would you rate the setup guidance?",
                scale: "star",
                range: "10",
                lowerLabel: "Poor",
                upperLabel: "Excellent",
              }),
            ],
          },
        ],
        ending: null,
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: generateInput,
    });
    const elements = result.payload.blocks.flatMap((block) => block.elements);

    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
    expect(elements[0]).toMatchObject({
      type: "csat",
      subheader: { "en-US": "Think about the first setup session." },
      scale: "number",
      range: 5,
      lowerLabel: { "en-US": "Very dissatisfied" },
      upperLabel: { "en-US": "Very satisfied" },
    });
    expect(elements[1]).toMatchObject({ type: "ces", scale: "number", range: 7 });
    expect(elements[2]).toMatchObject({
      type: "ranking",
      choices: [
        { id: "choice_1", label: { "en-US": "Speed" } },
        { id: "choice_2", label: { "en-US": "Guidance" } },
        { id: "choice_3", label: { "en-US": "Integrations" } },
      ],
    });
    expect(elements[3]).toMatchObject({
      type: "matrix",
      rows: [
        { id: "row_1", label: { "en-US": "Setup" } },
        { id: "row_2", label: { "en-US": "Activation" } },
      ],
      columns: [
        { id: "column_1", label: { "en-US": "Poor" } },
        { id: "column_2", label: { "en-US": "Good" } },
        { id: "column_3", label: { "en-US": "Excellent" } },
      ],
    });
    expect(elements[4]).toMatchObject({ type: "date", format: "M-d-y" });
    expect(elements[5]).toMatchObject({
      type: "nps",
      lowerLabel: { "en-US": "Not likely" },
      upperLabel: { "en-US": "Very likely" },
    });
    expect(elements[6]).toMatchObject({
      type: "rating",
      scale: "star",
      range: 10,
      lowerLabel: { "en-US": "Poor" },
      upperLabel: { "en-US": "Excellent" },
    });
  });

  test("surfaces create payload validation failures after generating a schema-valid draft", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
        name: "Recall Reference Survey",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Invalid recall",
            questions: [
              generatedElement({
                type: "openText",
                headline: "Please explain #recall:missing_id/fallback:your answer#",
                longAnswer: true,
              }),
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

  test("uses the generated survey language for the create payload and returns it", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "es-ES",
        name: "Encuesta de onboarding",
        description: "Entender la experiencia inicial.",
        welcomeCard: {
          enabled: false,
          headline: null,
          subheader: null,
          buttonLabel: null,
        },
        blocks: [
          {
            name: "Experiencia",
            questions: [
              {
                type: "openText",
                headline: "Que deberiamos mejorar?",
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
          headline: "Gracias por tu feedback",
          subheader: null,
        },
      },
    } as Awaited<ReturnType<typeof generateOrganizationAIObject>>);

    const result = await generateV3SurveyCreatePayloadFromPrompt({
      organizationId: "org_1",
      input: {
        ...generateInput,
        language: "es-ES",
        prompt: "Mide la experiencia de onboarding de usuarios nuevos.",
      },
    });

    expect(result.language).toBe("es-ES");
    expect(result.payload.defaultLanguage).toBe("es-ES");
    expect(result.payload.languages).toEqual([{ code: "es-ES", default: true, enabled: true }]);
    expect(result.payload.metadata.title).toEqual({ "es-ES": "Encuesta de onboarding" });
    expect(result.validation.languages).toEqual([{ code: "es-ES", default: true, enabled: true }]);
    expect(generateOrganizationAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Preferred survey language: es-ES"),
      })
    );
  });

  test("rejects generated survey languages outside the allowlist", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "it-IT",
        name: "Survey non supportato",
        description: null,
        welcomeCard: null,
        blocks: [
          {
            name: "Feedback",
            questions: [
              {
                type: "openText",
                headline: "Cosa dovremmo migliorare?",
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

  test("surfaces invalid generated objects as validation failures", async () => {
    vi.mocked(generateOrganizationAIObject).mockResolvedValueOnce({
      object: {
        language: "en-US",
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
