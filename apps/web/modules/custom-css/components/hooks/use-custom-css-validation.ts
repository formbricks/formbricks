"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type TCustomCssInput, type TCustomCssScope } from "@formbricks/types/custom-css";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { validateCustomCss } from "../lib/api-client";
import { type TCustomCssDraft, isOverCustomCssByteLimit, normalizeCustomCssInput } from "../lib/draft";
import {
  CUSTOM_CSS_VALIDATION_DEBOUNCE_MS,
  type TCustomCssDraftCheck,
  type TCustomCssLastValid,
  type TCustomCssValidationState,
  customCssKeys,
  deriveCustomCssValidationState,
  getCustomCssDraftKey,
  getNextLastValid,
  getSourceTooLargeError,
  parseCustomCssDraftKey,
} from "../lib/validation";

const NO_CSS: TCustomCssInput = { light: null, dark: null };

/**
 * Live validation of a Custom CSS draft through `POST /api/v3/surveys/validate` (ENG-3553).
 *
 * - Debounced by about 300 ms; the debounce runs on the draft's content key, so only a content change
 *   restarts it.
 * - Responses are cached under the content they were computed for, so a slow answer to an older draft
 *   can never stand in for the current one.
 * - The preview only ever receives compiled CSS the server returned for a valid draft. While the
 *   current draft is pending, invalid or could not be checked, the last valid draft's CSS stays on
 *   screen and `isPreviewBehind` says so.
 *
 * Never mutates anything: the route is read-only, and an unsaved draft has no side effects.
 */
export const useCustomCssValidation = (params: {
  workspaceId: string;
  scope: TCustomCssScope;
  surveyId?: string | null;
  draft: TCustomCssDraft;
  enabled: boolean;
}): TCustomCssValidationState => {
  const { workspaceId, scope, surveyId, draft, enabled } = params;
  const input = normalizeCustomCssInput(draft);
  const currentKey = getCustomCssDraftKey(input);
  const debouncedKey = useDebouncedValue(currentKey, CUSTOM_CSS_VALIDATION_DEBOUNCE_MS);
  // Parsing a 100 KB key is not free, and the key only changes once per debounce.
  const debouncedInput = useMemo(() => parseCustomCssDraftKey(debouncedKey), [debouncedKey]);
  const checkedInput = debouncedInput ?? NO_CSS;

  const query = useQuery({
    queryKey: customCssKeys.validation({ workspaceId, scope, surveyId, input: checkedInput }),
    queryFn: ({ signal }) => validateCustomCss({ workspaceId, scope, surveyId, input: checkedInput, signal }),
    enabled: enabled && debouncedInput !== null && !isOverCustomCssByteLimit(scope, debouncedInput),
    // The same content always validates the same way within a session, and each entry can hold up to
    // twice the scope budget in source and output, so entries are reused but not hoarded.
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  let check: TCustomCssDraftCheck;
  if (!enabled || input === null) {
    check = { kind: "empty" };
  } else if (isOverCustomCssByteLimit(scope, input)) {
    check = { kind: "local-error", errors: [getSourceTooLargeError(scope)] };
  } else if (debouncedKey !== currentKey || query.status === "pending") {
    check = { kind: "pending" };
  } else if (query.status === "error") {
    check = { kind: "request-failed" };
  } else {
    check = { kind: "settled", result: query.data };
  }

  const checkKey = enabled ? currentKey : "";
  const [lastValid, setLastValid] = useState<TCustomCssLastValid | null>(null);
  const nextLastValid = getNextLastValid(lastValid, check, checkKey);
  if (nextLastValid !== lastValid) {
    // Derived during render (React's "adjust state when a prop changes" pattern) rather than in an
    // effect, so the preview never renders one frame with the previous draft's state.
    setLastValid(nextLastValid);
  }

  return deriveCustomCssValidationState(check, nextLastValid, checkKey);
};
