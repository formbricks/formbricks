import { createId } from "@paralleldrive/cuid2";
import mammoth from "mammoth";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { iso639Languages } from "@formbricks/i18n-utils/src/utils";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";
import { SURVEY_EXPORT_VERSION, type TSurveyExportData, type TSurveyExportPayload } from "../export-survey";

const ZLLMQuestionType = z.enum(["openText", "singleChoice", "multiChoice", "nps", "rating"]);

const ZLLMTextEntry = z.object({
  languageCode: z.string().min(1),
  text: z.string(),
});

const ZLLMTextByLanguage = z.array(ZLLMTextEntry).default([]);

const ZLLMSurveyQuestion = z.object({
  id: z.string().min(1),
  type: ZLLMQuestionType,
  title: ZLLMTextByLanguage,
  description: ZLLMTextByLanguage.nullable().default(null),
  required: z.boolean().default(false),
  options: z.array(ZLLMTextByLanguage).default([]),
  allowOther: z.boolean().default(false),
  lowerLabel: ZLLMTextByLanguage.nullable().default(null),
  upperLabel: ZLLMTextByLanguage.nullable().default(null),
});

const ZLLMDetectedLanguage = z.object({
  code: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const ZLLMLanguageDetection = z.object({
  languages: z.array(ZLLMDetectedLanguage).min(1),
  primaryLanguageCode: z.string().nullable().default(null),
  isAmbiguous: z.boolean().default(false),
  ambiguityReasons: z.array(z.string()).default([]),
});

const ZLLMSurveyExtraction = z.object({
  surveyTitle: ZLLMTextByLanguage,
  intro: ZLLMTextByLanguage.nullable().default(null),
  outro: ZLLMTextByLanguage.nullable().default(null),
  questions: z.array(ZLLMSurveyQuestion).min(1),
  notes: z.array(z.string()).default([]),
});

type TLLMSurveyExtraction = z.infer<typeof ZLLMSurveyExtraction>;
type TLLMLanguageDetection = z.infer<typeof ZLLMLanguageDetection>;
type TLocalizedText = { default: string; [languageCode: string]: string };

interface TDetectedLanguageResult {
  code: string;
  confidence: number;
  evidence: string[];
}

export interface TDocxConversionResult {
  surveyData: TSurveyExportPayload;
  notes: string[];
  detectedLanguages: TDetectedLanguageResult[];
}

export interface TDocxConversionContext {
  importRunId?: string;
  environmentId?: string;
  userId?: string;
}

const LANGUAGE_DETECTION_SYSTEM_PROMPT = `
You detect languages used in survey content extracted from DOCX.

Rules:
- Detect only languages clearly present in user-facing survey text.
- Use ISO 639-1 two-letter codes in "code" whenever possible.
- Include confidence between 0 and 1.
- Mark isAmbiguous=true if language identity is uncertain or mixed.
- Add concise reasons in ambiguityReasons when ambiguous.
- Return strict JSON matching schema.
`.trim();

const SEMANTIC_EXTRACTION_SYSTEM_PROMPT = `
You convert survey text from a .docx document into structured multilingual survey data.

Rules:
- Extract only questions explicitly present in the input.
- Do not invent extra questions, options, logic rules, or metadata.
- If a question type is unclear, default to openText.
- Use only these types: openText, singleChoice, multiChoice, nps, rating.
- For singleChoice and multiChoice, include at least two options if available.
- If a choice question contains "Other (please specify)" (or equivalent), set allowOther=true and do not add "Other" into options.
- For nps and rating, put scale anchors into lowerLabel and upperLabel fields (not in description), when present.
- Return multilingual text arrays for all translatable fields using items:
  { "languageCode": "<code>", "text": "<localized text>" }.
- Only use the language codes supplied by the user message.
- Keep wording close to source text.
- Return strict JSON matching schema.
`.trim();

const LANGUAGE_CONFIDENCE_THRESHOLD = 0.6;

const languageAliasMap: Record<string, string> = {
  english: "en",
  german: "de",
  deutsch: "de",
  french: "fr",
  spanish: "es",
  portuguese: "pt",
  italian: "it",
  dutch: "nl",
  japanese: "ja",
  chinese: "zh",
  swedish: "sv",
  russian: "ru",
  arabic: "ar",
};

const getOpenAIClient = (): OpenAI => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
};

const extractRawTextFromDocx = async (fileBuffer: Buffer): Promise<string> => {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const text = result.value.trim();

  if (!text) {
    throw new Error("Could not extract text from document");
  }

  return text;
};

const normalizeLanguageCode = (rawCode: string): string | null => {
  const normalized = rawCode.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const aliasResolved = languageAliasMap[normalized] ?? normalized;
  const baseCode = aliasResolved.split(/[-_]/)[0];
  if (!baseCode) {
    return null;
  }

  const fromIsoList = iso639Languages.find((language) => {
    const alpha2 = language.alpha2?.toLowerCase();
    const code = language.code?.toLowerCase();
    const englishLabel = language.label?.["en-US"]?.toLowerCase();
    return alpha2 === baseCode || code === baseCode || englishLabel === aliasResolved;
  });

  return fromIsoList?.alpha2?.toLowerCase() ?? baseCode;
};

const normalizeTextByLanguage = (
  value: Array<{ languageCode: string; text: string }> | null | undefined
): Record<string, string> => {
  if (!value) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const entry of value) {
    const rawLanguageCode = entry.languageCode;
    const text = entry.text;
    const languageCode = normalizeLanguageCode(rawLanguageCode);
    if (!languageCode) {
      continue;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      continue;
    }

    if (!(languageCode in normalized)) {
      normalized[languageCode] = trimmed;
    }
  }

  return normalized;
};

const toLocalizedText = ({
  value,
  languageCodes,
  defaultLanguageCode,
  required,
  fieldLabel,
}: {
  value: Array<{ languageCode: string; text: string }> | null | undefined;
  languageCodes: string[];
  defaultLanguageCode: string;
  required: boolean;
  fieldLabel: string;
}): TLocalizedText => {
  const normalizedValue = normalizeTextByLanguage(value);
  const fallbackDefault = Object.values(normalizedValue).find((entry) => entry.trim().length > 0);
  const defaultText = normalizedValue[defaultLanguageCode] ?? fallbackDefault ?? "";

  if (required && defaultText.trim().length === 0) {
    throw new Error(`Missing required translation for ${fieldLabel} (${defaultLanguageCode})`);
  }

  const localized: TLocalizedText = { default: defaultText };

  for (const languageCode of languageCodes) {
    if (languageCode === defaultLanguageCode) {
      continue;
    }

    const translatedValue = normalizedValue[languageCode] ?? "";
    if (required && translatedValue.trim().length === 0) {
      throw new Error(`Missing required translation for ${fieldLabel} (${languageCode})`);
    }

    localized[languageCode] = translatedValue;
  }

  return localized;
};

const sanitizeDetectedLanguages = (detection: TLLMLanguageDetection) => {
  const mergedLanguages = new Map<string, TDetectedLanguageResult>();
  for (const detectedLanguage of detection.languages) {
    const normalizedCode = normalizeLanguageCode(detectedLanguage.code);
    if (!normalizedCode) {
      continue;
    }

    const existing = mergedLanguages.get(normalizedCode);
    if (!existing) {
      mergedLanguages.set(normalizedCode, {
        code: normalizedCode,
        confidence: detectedLanguage.confidence,
        evidence: [...detectedLanguage.evidence],
      });
      continue;
    }

    mergedLanguages.set(normalizedCode, {
      code: normalizedCode,
      confidence: Math.max(existing.confidence, detectedLanguage.confidence),
      evidence: [...new Set([...existing.evidence, ...detectedLanguage.evidence])],
    });
  }

  const languages = [...mergedLanguages.values()].sort((a, b) => b.confidence - a.confidence);
  if (languages.length === 0) {
    throw new Error("No supported languages could be detected in the DOCX survey content");
  }

  const normalizedPrimaryLanguageCode = detection.primaryLanguageCode
    ? normalizeLanguageCode(detection.primaryLanguageCode)
    : null;
  const primaryLanguageCode = normalizedPrimaryLanguageCode ?? languages[0].code;

  const ambiguityReasons = [...detection.ambiguityReasons];

  const topConfidence = languages[0]?.confidence ?? 0;
  if (topConfidence < LANGUAGE_CONFIDENCE_THRESHOLD) {
    ambiguityReasons.push(
      `Top language confidence (${topConfidence.toFixed(2)}) is below threshold (${LANGUAGE_CONFIDENCE_THRESHOLD.toFixed(2)})`
    );
  }

  const highConfidenceLanguageCount = languages.filter(
    (language) => language.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
  ).length;
  const canResolveParallelLanguageVariants =
    detection.isAmbiguous && languages.length >= 2 && highConfidenceLanguageCount >= 2;

  if (detection.isAmbiguous && !canResolveParallelLanguageVariants) {
    if (ambiguityReasons.length === 0) {
      ambiguityReasons.push("Model flagged language detection as ambiguous");
    }
  }

  return {
    languages,
    primaryLanguageCode,
    isAmbiguous:
      detection.isAmbiguous && !canResolveParallelLanguageVariants ? ambiguityReasons.length > 0 : false,
    ambiguityReasons,
  };
};

const sanitizeQuestionId = (rawId: string, fallbackIndex: number): string => {
  const sanitized = rawId
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, "_")
    .replaceAll(/[^a-z0-9_-]/g, "");

  if (!sanitized) {
    return `q_${fallbackIndex + 1}`;
  }

  return sanitized;
};

const ensureUniqueQuestionIds = (questions: TLLMSurveyExtraction["questions"]) => {
  const usedIds = new Set<string>();
  return questions.map((question, index) => {
    let candidate = sanitizeQuestionId(question.id, index);
    let suffix = 2;

    while (usedIds.has(candidate)) {
      candidate = `${sanitizeQuestionId(question.id, index)}_${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    return { ...question, id: candidate };
  });
};

const normalizeScaleAnchorLabel = (label: string | null): string | null => {
  if (!label) {
    return null;
  }

  const cleanedLabel = label
    .trim()
    // Remove leading number tokens with optional bracket and separator.
    .replace(/^\s*(?:\(\d{1,2}\)|\[\d{1,2}\]|\d{1,2})\s*[:=-]?\s*/u, "")
    .trim();

  return cleanedLabel.length > 0 ? cleanedLabel : null;
};

const normalizeLocalizedScaleLabel = (value: TLocalizedText): TLocalizedText | undefined => {
  const normalized: TLocalizedText = { default: value.default };

  for (const [languageCode, label] of Object.entries(value)) {
    const cleanedLabel = normalizeScaleAnchorLabel(label);
    if (!cleanedLabel) {
      if (languageCode === "default") {
        return undefined;
      }
      normalized[languageCode] = "";
      continue;
    }

    normalized[languageCode] = cleanedLabel;
  }

  if (!normalized.default || normalized.default.trim().length === 0) {
    return undefined;
  }

  return normalized;
};

const getScaleLabels = ({
  question,
  languageCodes,
  defaultLanguageCode,
  fieldPrefix,
}: {
  question: TLLMSurveyExtraction["questions"][number];
  languageCodes: string[];
  defaultLanguageCode: string;
  fieldPrefix: string;
}) => {
  const lowerLabel = normalizeLocalizedScaleLabel(
    toLocalizedText({
      value: question.lowerLabel,
      languageCodes,
      defaultLanguageCode,
      required: false,
      fieldLabel: `${fieldPrefix}.lowerLabel`,
    })
  );
  const upperLabel = normalizeLocalizedScaleLabel(
    toLocalizedText({
      value: question.upperLabel,
      languageCodes,
      defaultLanguageCode,
      required: false,
      fieldLabel: `${fieldPrefix}.upperLabel`,
    })
  );

  return {
    lowerLabel,
    upperLabel,
  };
};

const getMultipleChoiceConfig = ({
  question,
  languageCodes,
  defaultLanguageCode,
  fieldPrefix,
}: {
  question: TLLMSurveyExtraction["questions"][number];
  languageCodes: string[];
  defaultLanguageCode: string;
  fieldPrefix: string;
}) => {
  const normalizedOptions = question.options
    .slice(0, 25)
    .map((option, index) =>
      toLocalizedText({
        value: option,
        languageCodes,
        defaultLanguageCode,
        required: true,
        fieldLabel: `${fieldPrefix}.options[${index}]`,
      })
    )
    .filter((option) => !/^other(\s*\(.*\))?$/i.test(option.default.trim()));

  const choices = normalizedOptions.map((option) => ({
    id: createId(),
    label: option,
  }));

  if (question.allowOther) {
    const otherLabel: TLocalizedText = { default: "Other" };
    const otherPlaceholder: TLocalizedText = { default: "Please specify" };
    for (const languageCode of languageCodes) {
      if (languageCode === defaultLanguageCode) {
        continue;
      }
      otherLabel[languageCode] = "";
      otherPlaceholder[languageCode] = "";
    }

    choices.push({
      id: "other",
      label: otherLabel,
    });

    return {
      choices,
      otherOptionPlaceholder: otherPlaceholder,
    };
  }

  return {
    choices,
    otherOptionPlaceholder: undefined,
  };
};

const mapToExportData = (
  llmData: TLLMSurveyExtraction,
  languageCodes: string[],
  defaultLanguageCode: string
): TSurveyExportData => {
  const surveyName = toLocalizedText({
    value: llmData.surveyTitle,
    languageCodes,
    defaultLanguageCode,
    required: true,
    fieldLabel: "surveyTitle",
  }).default;

  const questionElements = ensureUniqueQuestionIds(llmData.questions).map((question) => {
    const fieldPrefix = `question.${question.id}`;
    const baseQuestion = {
      id: question.id,
      headline: toLocalizedText({
        value: question.title,
        languageCodes,
        defaultLanguageCode,
        required: true,
        fieldLabel: `${fieldPrefix}.title`,
      }),
      subheader: question.description
        ? toLocalizedText({
            value: question.description,
            languageCodes,
            defaultLanguageCode,
            required: false,
            fieldLabel: `${fieldPrefix}.description`,
          })
        : undefined,
      required: question.required,
    };

    switch (question.type) {
      case "openText":
        return {
          ...baseQuestion,
          type: "openText",
          inputType: "text" as const,
          charLimit: { enabled: false },
        };
      case "singleChoice":
      case "multiChoice":
        return {
          ...baseQuestion,
          type: question.type === "singleChoice" ? "multipleChoiceSingle" : "multipleChoiceMulti",
          ...getMultipleChoiceConfig({
            question,
            languageCodes,
            defaultLanguageCode,
            fieldPrefix,
          }),
        };
      case "nps":
        return {
          ...baseQuestion,
          type: "nps",
          ...getScaleLabels({
            question,
            languageCodes,
            defaultLanguageCode,
            fieldPrefix,
          }),
        };
      case "rating":
        return {
          ...baseQuestion,
          type: "rating",
          scale: "number" as const,
          range: 5 as const,
          ...getScaleLabels({
            question,
            languageCodes,
            defaultLanguageCode,
            fieldPrefix,
          }),
        };
      default:
        throw new Error(`Unsupported question type: ${String(question.type)}`);
    }
  });

  const blocks = questionElements.map((element, index) => ({
    id: createId(),
    name: `Question ${index + 1}`,
    elements: [element],
  }));

  return {
    name: surveyName,
    type: "link",
    questions: [],
    blocks,
    welcomeCard: {
      enabled: Boolean(llmData.intro && Object.keys(llmData.intro).length > 0),
      headline: llmData.intro
        ? toLocalizedText({
            value: llmData.intro,
            languageCodes,
            defaultLanguageCode,
            required: false,
            fieldLabel: "intro",
          })
        : undefined,
      timeToFinish: true,
      showResponseCount: false,
    },
    endings: [
      {
        id: createId(),
        type: "endScreen",
        headline: llmData.outro
          ? toLocalizedText({
              value: llmData.outro,
              languageCodes,
              defaultLanguageCode,
              required: false,
              fieldLabel: "outro",
            })
          : {
              default: "Thank you!",
              ...Object.fromEntries(
                languageCodes.filter((code) => code !== defaultLanguageCode).map((code) => [code, ""])
              ),
            },
      },
    ],
    triggers: [],
    languages: languageCodes.map((code) => ({
      code,
      enabled: true,
      default: code === defaultLanguageCode,
    })),
    followUps: [],
    showLanguageSwitch: languageCodes.length > 1,
  };
};

const detectSurveyLanguages = async (
  openai: OpenAI,
  extractedText: string
): Promise<{
  languages: TDetectedLanguageResult[];
  primaryLanguageCode: string;
  ambiguityReasons: string[];
}> => {
  const languageResponse = await openai.responses.parse({
    model: "gpt-4.1",
    input: [
      {
        role: "system",
        content: LANGUAGE_DETECTION_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Detect languages from this survey document text and return strict JSON:\n\n${extractedText}`,
      },
    ],
    text: {
      format: zodTextFormat(ZLLMLanguageDetection, "survey_docx_language_detection"),
    },
  });

  const parsedLanguageOutput = languageResponse.output_parsed;
  if (!parsedLanguageOutput) {
    throw new Error("The model did not return structured language detection data");
  }

  const normalizedLanguageDetection = sanitizeDetectedLanguages(parsedLanguageOutput);
  if (normalizedLanguageDetection.isAmbiguous) {
    throw new Error(
      `Language detection is ambiguous: ${normalizedLanguageDetection.ambiguityReasons.join("; ")}`
    );
  }

  return {
    languages: normalizedLanguageDetection.languages,
    primaryLanguageCode: normalizedLanguageDetection.primaryLanguageCode,
    ambiguityReasons: normalizedLanguageDetection.ambiguityReasons,
  };
};

const extractSurveySemantics = async (
  openai: OpenAI,
  extractedText: string,
  languageCodes: string[],
  defaultLanguageCode: string
): Promise<TLLMSurveyExtraction> => {
  const response = await openai.responses.parse({
    model: "gpt-4.1",
    input: [
      { role: "system", content: SEMANTIC_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Allowed language codes: ${languageCodes.join(", ")}`,
          `Default language code: ${defaultLanguageCode}`,
          "Convert this survey document into structured multilingual survey data:",
          extractedText,
        ].join("\n\n"),
      },
    ],
    text: {
      format: zodTextFormat(ZLLMSurveyExtraction, "survey_docx_semantic_extraction"),
    },
  });

  const parsedOutput = response.output_parsed;
  if (!parsedOutput) {
    throw new Error("The model did not return structured survey extraction data");
  }

  return parsedOutput;
};

export const convertDocxToSurveyPayload = async (
  fileBuffer: Buffer,
  fileName: string,
  context?: TDocxConversionContext
): Promise<TDocxConversionResult> => {
  logger.info(
    {
      importRunId: context?.importRunId,
      environmentId: context?.environmentId,
      userId: context?.userId,
      fileName,
      fileSizeBytes: fileBuffer.length,
    },
    "Survey import: starting DOCX conversion"
  );

  try {
    if (!fileName.toLowerCase().endsWith(".docx")) {
      throw new Error("Only .docx files are supported. Please convert your .doc file to .docx first.");
    }

    const extractedText = await extractRawTextFromDocx(fileBuffer);
    logger.info(
      {
        importRunId: context?.importRunId,
        extractedChars: extractedText.length,
      },
      "Survey import: extracted DOCX text"
    );

    const openai = getOpenAIClient();

    const languageDetection = await detectSurveyLanguages(openai, extractedText);
    const languageCodes = languageDetection.languages.map((entry) => entry.code);

    logger.info(
      {
        importRunId: context?.importRunId,
        detectedLanguageCount: languageDetection.languages.length,
        detectedLanguages: languageDetection.languages.map(
          (entry) => `${entry.code}:${entry.confidence.toFixed(2)}`
        ),
        primaryLanguageCode: languageDetection.primaryLanguageCode,
      },
      "Survey import: language detection completed"
    );

    const parsedOutput = await extractSurveySemantics(
      openai,
      extractedText,
      languageCodes,
      languageDetection.primaryLanguageCode
    );

    logger.info(
      {
        importRunId: context?.importRunId,
        surveyTitle: parsedOutput.surveyTitle,
        questionCount: parsedOutput.questions.length,
        notesCount: parsedOutput.notes.length,
      },
      "Survey import: LLM returned structured extraction"
    );

    const surveyData = mapToExportData(parsedOutput, languageCodes, languageDetection.primaryLanguageCode);

    const result = {
      surveyData: {
        version: SURVEY_EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        data: surveyData,
      },
      notes: [
        ...parsedOutput.notes,
        `Detected languages: ${languageDetection.languages
          .map((entry) => `${entry.code} (${Math.round(entry.confidence * 100)}%)`)
          .join(", ")}`,
      ],
      detectedLanguages: languageDetection.languages,
    };

    logger.info(
      {
        importRunId: context?.importRunId,
        outputQuestionCount: parsedOutput.questions.length,
        outputBlockCount: result.surveyData.data.blocks.length,
      },
      "Survey import: DOCX conversion completed"
    );

    return result;
  } catch (error) {
    logger.error(
      {
        importRunId: context?.importRunId,
        environmentId: context?.environmentId,
        userId: context?.userId,
        fileName,
      },
      "Survey import: DOCX conversion failed"
    );
    logger.error(error, "Survey import: DOCX conversion error details");
    throw error;
  }
};
