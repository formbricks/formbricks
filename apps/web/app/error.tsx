"use client";

// Error components must be Client components
import { TFunction } from "i18next";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { type ClientErrorType, getClientErrorData } from "@formbricks/types/errors";
import { reportBoundaryError } from "@/lib/sentry/boundary-error";
import { Button } from "@/modules/ui/components/button";
import { ErrorComponent } from "@/modules/ui/components/error-component";

/**
 * Get translated error messages based on error type.
 *
 * A missing or inaccessible resource never reaches this boundary — pages call `notFound()` for it — so
 * the general copy describes a failure, not a permissions problem. Server errors arrive here stripped
 * to a generic message plus a `digest`, so there is nothing more specific to tell apart anyway.
 */
const getErrorMessages = (type: ClientErrorType, t: TFunction) => {
  if (type === "rate_limit") {
    return {
      title: t("common.error_rate_limit_title"),
      description: t("common.error_rate_limit_description"),
    };
  }

  return {
    title: t("common.something_went_wrong"),
    description: t("common.error_boundary_description"),
  };
};

const ErrorBoundary = ({
  error,
  retry,
}: Readonly<{ error: Error & { digest?: string }; retry: () => void }>) => {
  const { t } = useTranslation();
  const errorData = getClientErrorData(error);
  const { title, description } = getErrorMessages(errorData.type, t);

  useEffect(() => {
    reportBoundaryError(error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <ErrorComponent title={title} description={description} />
      {error.digest && (
        <p className="mt-2 text-xs text-slate-500" data-testid="error-digest">
          {t("common.error_id", { id: error.digest })}
        </p>
      )}
      {errorData.showButtons && (
        <div className="mt-2">
          <Button variant="secondary" onClick={() => retry()} className="mr-2">
            {t("common.try_again")}
          </Button>
          <Button onClick={() => (window.location.href = "/")}>{t("common.go_to_dashboard")}</Button>
        </div>
      )}
    </div>
  );
};

export default ErrorBoundary;
