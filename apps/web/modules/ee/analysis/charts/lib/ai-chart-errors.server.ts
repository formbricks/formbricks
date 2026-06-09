import "server-only";
import { NoObjectGeneratedError } from "ai";
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

  return null;
};
