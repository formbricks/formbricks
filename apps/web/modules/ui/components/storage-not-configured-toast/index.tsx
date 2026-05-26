"use client";

import { useTranslation } from "react-i18next";

interface StorageNotConfiguredToastProps {
  variant?: "notConfigured" | "uploadUnavailable";
}

export const StorageNotConfiguredToast = ({ variant = "notConfigured" }: StorageNotConfiguredToastProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex w-fit !max-w-md items-center justify-center gap-2">
      <span className="text-slate-900">
        {variant === "uploadUnavailable"
          ? t("common.file_upload_service_unavailable")
          : t("common.file_storage_not_set_up")}
      </span>
      <a
        className="text-slate-900 underline"
        href="https://formbricks.com/docs/self-hosting/configuration/file-uploads"
        target="_blank"
        rel="noopener noreferrer">
        {t("common.learn_more")}
      </a>
    </div>
  );
};
