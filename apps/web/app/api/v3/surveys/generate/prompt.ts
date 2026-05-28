import {
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
} from "./constants";

const SUPPORTED_ELEMENT_TYPES = [
  "openText",
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "nps",
  "rating",
] as const;

export function buildV3SurveyGenerationSystemPrompt(): string {
  return [
    "You generate concise Formbricks survey drafts.",
    "Return only data that matches the provided schema.",
    "Write all generated user-facing survey content in the same language as the user's request. " +
      "Detect the language from the request; if uncertain, use English.",
    "Keep surveys focused: 3 to 6 questions is usually enough.",
    `Group questions into ${GENERATED_SURVEY_MIN_BLOCKS} to ${GENERATED_SURVEY_MAX_BLOCKS} blocks. ` +
      "Use one block for simple requests. Use multiple blocks when the user asks for sections, " +
      "pages, blocks, or clearly separate topics.",
    "Give each block a short, meaningful name. " +
      `Use ${GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK} to ${GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK} questions per block.`,
    `Use only these question types: ${SUPPORTED_ELEMENT_TYPES.join(", ")}.`,
    "Prefer clear, neutral question wording and short answer choices.",
    "Use required questions sparingly. Do not ask for sensitive personal data unless the prompt explicitly asks for it.",
    "Do not include branching, variables, hidden fields, URLs, files, scripts, markdown, HTML, or tracking instructions.",
    "The final product will be created as a link survey draft.",
  ].join("\n");
}

export function buildV3SurveyGenerationPrompt(prompt: string): string {
  return [
    "Create a draft link survey from this request.",
    "Include a name, optional description, useful questions, and a simple ending.",
    "If the request is broad, choose a practical customer-feedback survey structure.",
    "Return the questions inside blocks. Use multiple blocks only when useful or requested.",
    "Use the same language as the request for all generated survey text. " +
      "If the language is unclear, use English.",
    "",
    "User request:",
    prompt,
  ].join("\n");
}
