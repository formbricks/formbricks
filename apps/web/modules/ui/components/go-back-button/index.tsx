"use client";

import { ArrowLeftIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface GoBackButtonProps {
  url?: string;
  previousPath?: string | null;
  settingsPathPrefix?: string;
  settingsFallbackUrl?: string;
}

export const GoBackButton = ({
  url,
  previousPath,
  settingsPathPrefix,
  settingsFallbackUrl,
}: Readonly<GoBackButtonProps>) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  const shouldRedirectToSettingsFallback =
    !!settingsFallbackUrl &&
    !!settingsPathPrefix &&
    !!previousPath &&
    previousPath.startsWith(settingsPathPrefix) &&
    previousPath !== pathname;

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        if (url) {
          router.push(url);
          return;
        }

        if (shouldRedirectToSettingsFallback) {
          router.replace(settingsFallbackUrl);
          return;
        }

        router.back();
      }}>
      <ArrowLeftIcon />
      {t("common.back")}
    </Button>
  );
};
