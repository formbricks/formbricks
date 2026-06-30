import {
  GENERATED_SURVEY_ELEMENT_TYPES,
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
} from "./constants";

export function buildV3SurveyGenerationSystemPrompt(
  allowedLocales: readonly string[],
  surveyType: string
): string {
  return [
    "You generate concise Formbricks survey drafts.",
    "Return only data that matches the provided schema.",
    "Write all generated user-facing survey content in the same language as the user's request. " +
      "Detect the language from the request; if it clearly matches an allowed survey language, use that language. " +
      "If uncertain or no allowed survey language is a confident match, " +
      "use the preferred survey language from the user prompt.",
    "Return the survey language exactly as one of the allowed survey language codes from the user prompt.",
    `Allowed survey languages: ${allowedLocales.join(", ")}.`,
    "Keep surveys focused: 3 to 6 questions is usually enough.",
    `Group questions into ${GENERATED_SURVEY_MIN_BLOCKS} to ${GENERATED_SURVEY_MAX_BLOCKS} blocks. ` +
      "Use one block for simple requests. Use multiple blocks when the user asks for sections, " +
      "pages, blocks, or clearly separate topics.",
    "Give each block a short, meaningful name. " +
      `Use ${GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK} to ${GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK} questions per block.`,
    "Rating-like questions must be single-question blocks: rating, csat, ces, nps, matrix, and ranking. " +
      "Do not place rating-like questions together in the same block.",
    `Use only these question types: ${GENERATED_SURVEY_ELEMENT_TYPES.join(", ")}.`,
    "Use csat for satisfaction, ces for effort, nps for loyalty, ranking for priorities, " +
      "matrix for repeated row-and-column ratings, and date only when the requested feedback needs a date.",
    'For rating questions, set range to one of the string values "5", "7", or "10".',
    'For csat questions, set range to "5". For ces questions, set range to "5" or "7".',
    "Prefer clear, neutral question wording and short answer choices.",
    "Use required questions sparingly. Do not ask for sensitive personal data unless the prompt explicitly asks for it.",
    "Do not use file uploads, picture selection, address/contact collection, scheduling, CTA, consent, " +
      "embedded external forms, or any other question type outside the allowed list.",
    "Do not include branching, variables, hidden fields, URLs, files, scripts, markdown, HTML, or tracking instructions.",
    `The final product will be created as a ${surveyType} survey draft.`,
    surveyType === "app"
      ? "This is an in-app survey shown inside the user's web or mobile app, so favor short questions that are easy to answer inside a small embedded widget."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildV3SurveyGenerationPrompt(
  prompt: string,
  surveyType: string,
  preferredLanguage: string,
  allowedLocales: readonly string[]
): string {
  return [
    `Create a draft ${surveyType} survey from this request.`,
    "Include a name, optional description, useful questions, and a simple ending.",
    "If the request is broad, choose a practical customer-feedback survey structure.",
    "Return the questions inside blocks. Use multiple blocks only when useful or requested.",
    "Keep rating-like questions in their own single-question blocks: rating, csat, ces, nps, matrix, and ranking.",
    "Use the same language as the request for all generated survey text. " +
      "If the request language is unclear or cannot be matched to an allowed survey language, " +
      "use the preferred survey language.",
    "If you enable the welcome card, include a short button label in the same language.",
    `Allowed survey languages: ${allowedLocales.join(", ")}.`,
    `Preferred survey language: ${preferredLanguage}.`,
    "Set the returned language to exactly one allowed survey language code.",
    "",
    "User request:",
    prompt,
  ].join("\n");
}
