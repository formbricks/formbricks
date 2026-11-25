import {
  V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH,
  V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS,
} from "./constants";

/**
 * Whether a prompt says enough to generate a survey from: at least 24 characters and 4 words once
 * trimmed. The one copy of the rule. The generate routes refuse a prompt that fails it before any AI
 * call, and the Create with AI form gates its Create button on it (ENG-2187), so the two cannot drift.
 */
export const isV3SurveyGeneratePromptDetailed = (prompt: string): boolean => {
  const normalizedPrompt = prompt.trim();
  const wordCount = normalizedPrompt.split(/\s+/).filter(Boolean).length;

  return (
    normalizedPrompt.length >= V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH &&
    wordCount >= V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS
  );
};
