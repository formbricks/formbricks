import "server-only";
import { NoObjectGeneratedError } from "ai";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { InvalidInputError } from "@formbricks/types/errors";
import { AI_CHART_PROMPT_ERROR_CODE } from "./ai-chart-errors";

/**
 * Map structured-output failures from the AI SDK to a stable chart prompt
 * error code. Provider, network, auth, config, and Cube errors intentionally
 * remain on the existing error path.
 */
export const getAIChartPromptError = (error: unknown): InvalidInputError | null => {
  if (NoObjectGeneratedError.isInstance(error)) {
    return new InvalidInputError(AI_CHART_PROMPT_ERROR_CODE);
  }

  // A generation that ran out of output budget produced no query either, and it is the prompt and
  // the deployed model between them that decide whether it fits. Raising the cap is the fix; this
  // keeps the remaining cases as the same "could not be converted" message the user can act on,
  // rather than the 500 they got while the budget was too small to hold a thinking model's answer.
  if (error instanceof AIOutputTokenLimitError) {
    return new InvalidInputError(AI_CHART_PROMPT_ERROR_CODE);
  }

  return null;
};
