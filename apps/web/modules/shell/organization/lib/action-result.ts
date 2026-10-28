import { getFormattedErrorMessage } from "@/lib/utils/error-message";

/** The part of a safe-action result the organization pages read. */
export type TActionResult = { data?: unknown; serverError?: string; validationErrors?: unknown } | undefined;

/** `null` when the action went through, otherwise the message to show (the server's, else `fallback`). */
export const getActionErrorMessage = (result: TActionResult, fallback: string): string | null => {
  if (!result?.serverError && !result?.validationErrors) {
    return null;
  }
  return getFormattedErrorMessage(result) || fallback;
};
