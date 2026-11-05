"use client";

import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

/** Something that could not load, with the reason and a way to try again. */
export const ListLoadError = ({
  error,
  onRetry,
  title,
}: Readonly<{ error: unknown; onRetry: () => unknown; title?: string }>) => {
  const { t } = useTranslation();

  return (
    <Alert variant="error">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>
        {getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}
      </AlertDescription>
      <AlertButton onClick={() => onRetry()}>{t("common.retry")}</AlertButton>
    </Alert>
  );
};
