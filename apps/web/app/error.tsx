"use client";

// Error components must be Client components
import { Button } from "@/modules/ui/components/button";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import * as Sentry from "@sentry/nextjs";
import { useTranslate } from "@tolgee/react";

const ErrorBoundary = ({ error, reset }: { error: Error; reset: () => void }) => {
  const { t } = useTranslate();
  if (process.env.NODE_ENV === "development") {
    console.error(error.message);
  } else {
    Sentry.captureException(error);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <ErrorComponent />
      <div className="mt-2">
        <Button variant="secondary" onClick={() => reset()} className="mr-2">
          {t("common.try_again")}
        </Button>
        <Button onClick={() => (window.location.href = "/")}>{t("common.go_to_dashboard")}</Button>
      </div>
    </div>
  );
};

export default ErrorBoundary;
