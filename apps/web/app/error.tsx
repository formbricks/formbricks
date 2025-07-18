"use client";

// Error components must be Client components
import { Button } from "@/modules/ui/components/button";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import * as Sentry from "@sentry/nextjs";
import { useTranslate } from "@tolgee/react";
import { type ClientErrorType, getClientErrorData } from "@formbricks/types/errors";

/**
 * Get translated error messages based on error type
 * All translation keys are directly visible to Tolgee's static analysis
 */
const getErrorMessages = (type: ClientErrorType, t: (key: string) => string) => {
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
  const { t } = useTranslate();
  const errorData = getClientErrorData(error);
  const { title, description } = getErrorMessages(errorData.type, t);

  if (process.env.NODE_ENV === "development") {
    console.error(error.message);
  } else {
    Sentry.captureException(error);
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
