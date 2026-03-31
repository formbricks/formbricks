import { beforeEach, describe, expect, test, vi } from "vitest";
import { convertDocxToSurveyPayload } from "./llm-docx-converter";

const byLanguage = (value: Record<string, string>) =>
  Object.entries(value).map(([languageCode, text]) => ({ languageCode, text }));

const { mockParse, mockExtractRawText } = vi.hoisted(() => ({
  mockParse: vi.fn(),
  mockExtractRawText: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "test-openai-key",
  },
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = {
      parse: mockParse,
    };
  },
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText: mockExtractRawText,
  },
}));

describe("convertDocxToSurveyPayload", () => {
  beforeEach(() => {
    mockParse.mockReset();
    mockExtractRawText.mockReset();
  });

  test("converts extracted DOCX into multilingual survey export payload", async () => {
    vi.mocked(mockExtractRawText).mockResolvedValue({
      value: "Customer Satisfaction Survey",
    });
    vi.mocked(mockParse)
      .mockResolvedValueOnce({
        output_parsed: {
          languages: [
            { code: "english", confidence: 0.98, evidence: ["Question titles"] },
            { code: "de-DE", confidence: 0.92, evidence: ["Section heading"] },
          ],
          primaryLanguageCode: "en-US",
          isAmbiguous: false,
          ambiguityReasons: [],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          surveyTitle: byLanguage({
            en: "CSAT Survey",
            de: "CSAT Umfrage",
          }),
          intro: byLanguage({
            en: "Please answer a few questions.",
            de: "Bitte beantworten Sie einige Fragen.",
          }),
          outro: byLanguage({
            en: "Thanks for your feedback.",
            de: "Vielen Dank fur Ihr Feedback.",
          }),
          notes: ["Question 2 inferred as single choice."],
          questions: [
            {
              id: "satisfaction",
              type: "singleChoice",
              title: byLanguage({
                en: "How satisfied are you?",
                de: "Wie zufrieden sind Sie?",
              }),
              description: null,
              required: true,
              options: [
                byLanguage({ en: "Very satisfied", de: "Sehr zufrieden" }),
                byLanguage({ en: "Satisfied", de: "Zufrieden" }),
                byLanguage({ en: "Not satisfied", de: "Nicht zufrieden" }),
              ],
              allowOther: true,
              lowerLabel: null,
              upperLabel: null,
            },
            {
              id: "comments",
              type: "openText",
              title: byLanguage({
                en: "Any additional comments?",
                de: "Weitere Kommentare?",
              }),
              description: byLanguage({
                en: "Optional",
                de: "Optional",
              }),
              required: false,
              options: [],
              allowOther: false,
              lowerLabel: null,
              upperLabel: null,
            },
            {
              id: "nps_score",
              type: "nps",
              title: byLanguage({
                en: "How likely are you to recommend us?",
                de: "Wie wahrscheinlich ist eine Empfehlung?",
              }),
              description: null,
              required: true,
              options: [],
              allowOther: false,
              lowerLabel: byLanguage({
                en: "0 Not likely",
                de: "0 Unwahrscheinlich",
              }),
              upperLabel: byLanguage({
                en: "10 Extremely likely",
                de: "10 Sehr wahrscheinlich",
              }),
            },
            {
              id: "rating",
              type: "rating",
              title: byLanguage({
                en: "Rate your overall experience",
                de: "Bewerten Sie Ihre Erfahrung",
              }),
              description: null,
              required: true,
              options: [],
              allowOther: false,
              lowerLabel: byLanguage({
                en: "1 - Very bad",
                de: "1 - Sehr schlecht",
              }),
              upperLabel: byLanguage({
                en: "5 = Very good",
                de: "5 = Sehr gut",
              }),
            },
          ],
        },
      });

    const result = await convertDocxToSurveyPayload(Buffer.from("docx-content"), "survey.docx");

    expect(result.notes).toContain("Question 2 inferred as single choice.");
    expect(result.notes.some((note) => note.includes("Detected languages: en"))).toBe(true);
    expect(result.surveyData.version).toBe("1.0.0");
    expect(result.surveyData.data.name).toBe("CSAT Survey");
    expect(result.detectedLanguages).toEqual([
      { code: "en", confidence: 0.98, evidence: ["Question titles"] },
      { code: "de", confidence: 0.92, evidence: ["Section heading"] },
    ]);
    expect(result.surveyData.data.languages).toEqual([
      { code: "en", enabled: true, default: true },
      { code: "de", enabled: true, default: false },
    ]);
    expect(result.surveyData.data.questions).toHaveLength(0);
    expect(result.surveyData.data.blocks).toHaveLength(4);
    expect(result.surveyData.data.blocks[0].elements[0].type).toBe("multipleChoiceSingle");
    expect(result.surveyData.data.blocks[0].elements[0].headline).toEqual({
      default: "How satisfied are you?",
      de: "Wie zufrieden sind Sie?",
    });
    expect(result.surveyData.data.blocks[0].elements[0].choices.at(-1)?.id).toBe("other");
    expect(result.surveyData.data.blocks[0].elements[0].otherOptionPlaceholder).toEqual({
      default: "Please specify",
      de: "",
    });
    expect(result.surveyData.data.blocks[1].elements[0].type).toBe("openText");
    expect(result.surveyData.data.blocks[2].elements[0].type).toBe("nps");
    expect(result.surveyData.data.blocks[2].elements[0].lowerLabel).toEqual({
      default: "Not likely",
      de: "Unwahrscheinlich",
    });
    expect(result.surveyData.data.blocks[2].elements[0].upperLabel).toEqual({
      default: "Extremely likely",
      de: "Sehr wahrscheinlich",
    });
    expect(result.surveyData.data.blocks[3].elements[0].type).toBe("rating");
    expect(result.surveyData.data.blocks[3].elements[0].lowerLabel).toEqual({
      default: "Very bad",
      de: "Sehr schlecht",
    });
    expect(result.surveyData.data.blocks[3].elements[0].upperLabel).toEqual({
      default: "Very good",
      de: "Sehr gut",
    });
  });

  test("rejects non-docx files", async () => {
    await expect(convertDocxToSurveyPayload(Buffer.from("x"), "survey.doc")).rejects.toThrow(
      "Only .docx files are supported"
    );
  });

  test("throws when no text can be extracted", async () => {
    vi.mocked(mockExtractRawText).mockResolvedValue({ value: "   " });

    await expect(convertDocxToSurveyPayload(Buffer.from("docx-content"), "survey.docx")).rejects.toThrow(
      "Could not extract text from document"
    );
  });

  test("throws when model does not return parsed output", async () => {
    vi.mocked(mockExtractRawText).mockResolvedValue({ value: "Survey content" });
    vi.mocked(mockParse).mockResolvedValue({ output_parsed: null });

    await expect(convertDocxToSurveyPayload(Buffer.from("docx-content"), "survey.docx")).rejects.toThrow(
      "did not return structured language detection data"
    );
  });

  test("throws when language detection is ambiguous", async () => {
    vi.mocked(mockExtractRawText).mockResolvedValue({ value: "Survey content" });
    vi.mocked(mockParse).mockResolvedValueOnce({
      output_parsed: {
        languages: [{ code: "en", confidence: 0.4, evidence: [] }],
        primaryLanguageCode: "en",
        isAmbiguous: true,
        ambiguityReasons: ["Mixed language hints"],
      },
    });

    await expect(convertDocxToSurveyPayload(Buffer.from("docx-content"), "survey.docx")).rejects.toThrow(
      "Language detection is ambiguous"
    );
  });

  test("accepts confidently detected parallel bilingual surveys", async () => {
    vi.mocked(mockExtractRawText).mockResolvedValue({ value: "English and Arabic survey content" });
    vi.mocked(mockParse)
      .mockResolvedValueOnce({
        output_parsed: {
          languages: [
            { code: "english", confidence: 0.97, evidence: ["Section EN"] },
            { code: "arabic", confidence: 0.95, evidence: ["Section AR"] },
          ],
          primaryLanguageCode: "english",
          isAmbiguous: true,
          ambiguityReasons: ["Parallel language versions"],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          surveyTitle: byLanguage({
            en: "Customer Feedback",
            ar: "ملاحظات العملاء",
          }),
          intro: null,
          outro: null,
          notes: [],
          questions: [
            {
              id: "q1",
              type: "openText",
              title: byLanguage({
                en: "How can we improve?",
                ar: "كيف يمكننا التحسين؟",
              }),
              description: null,
              required: true,
              options: [],
              allowOther: false,
              lowerLabel: null,
              upperLabel: null,
            },
          ],
        },
      });

    const result = await convertDocxToSurveyPayload(Buffer.from("docx-content"), "survey.docx");

    expect(result.detectedLanguages).toEqual([
      { code: "en", confidence: 0.97, evidence: ["Section EN"] },
      { code: "ar", confidence: 0.95, evidence: ["Section AR"] },
    ]);
    expect(result.surveyData.data.languages).toEqual([
      { code: "en", enabled: true, default: true },
      { code: "ar", enabled: true, default: false },
    ]);
  });
});
