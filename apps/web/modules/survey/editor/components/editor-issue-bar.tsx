"use client";

import { useTranslation } from "react-i18next";
import { keepFocusOutOfPreview } from "@/modules/survey/editor/lib/focus-issue";
import { ErrorSummary } from "@/modules/ui/components/error-summary";

interface EditorIssueBarProps {
  /** A failed save or publish that is not about the survey's content; the bar shows only while there is one. */
  readonly systemError: string | null;
  readonly shouldFocus: boolean;
  readonly onFocused: () => void;
}

/**
 * The slim bar under the menu bar for why the last save failed when the survey's content is not the reason.
 * Errors in the content are listed by the badge in the menu bar.
 */
export const EditorIssueBar = ({ systemError, shouldFocus, onFocused }: EditorIssueBarProps) => {
  const { t } = useTranslation();

  if (!systemError) return null;

  return (
    <ErrorSummary
      heading={t("workspace.surveys.edit.issue_system_error_heading")}
      description={systemError}
      shouldFocus={shouldFocus}
      // The preview can take focus when the editor scrolls to the first error: hand it back to the heading.
      onFocused={(heading) => {
        onFocused();
        keepFocusOutOfPreview(heading);
      }}
    />
  );
};
