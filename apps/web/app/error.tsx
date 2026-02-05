"use client";

// Error components must be Client components
import * as Sentry from "@sentry/nextjs";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { type ClientErrorType, getClientErrorData } from "@formbricks/types/errors";
import { Button } from "@/modules/ui/components/button";
import { ErrorComponent } from "@/modules/ui/components/error-component";

/**
 * Expected error names that should NOT be reported to Sentry.
 * These are handled gracefully in the UI (e.g., show "no access" or redirect).
 */
const EXPECTED_ERROR_NAMES = new Set(["AuthorizationError", "AuthenticationError", "TooManyRequestsError"]);

/**
 * Get translated error messages based on error type
 */
const getErrorMessages = (type: ClientErrorType, t: TFunction) => {
  if (type === "rate_limit") {
    return {
      title: t("common.error_rate_limit_title"),
      description: t("common.error_rate_limit_description"),
    };
  }

  return {
    title: t("common.error_component_title"),
    description: t("common.error_component_description"),
  };
};

const ErrorBoundary = ({ error, reset }: { error: Error; reset: () => void }) => {
  const { t } = useTranslation();
  const errorData = getClientErrorData(error);
  const { title, description } = getErrorMessages(errorData.type, t);

  const isExpectedError = EXPECTED_ERROR_NAMES.has(error.name);

  if (process.env.NODE_ENV === "development") {
    console.error(error.message);
  } else {
    // Only report unexpected errors to Sentry
    // Expected errors (auth failures, rate limits) are handled gracefully in the UI
    if (!isExpectedError) {
      Sentry.captureException(error);
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <ErrorComponent title={title} description={description} />
      {errorData.showButtons && (
        <div className="mt-2">
          <Button variant="secondary" onClick={() => reset()} className="mr-2">
            {t("common.try_again")}
          </Button>
          <Button onClick={() => (window.location.href = "/")}>{t("common.go_to_dashboard")}</Button>
        </div>
      )}
    </div>
  );
};

export default ErrorBoundary;
