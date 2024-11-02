"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@formbricks/ui/components/Button";

export const BackButton = () => {
  const router = useRouter();
  const t = useTranslations();
  return (
    <Button
      variant="secondary"
      size="sm"
      StartIcon={ArrowLeftIcon}
      onClick={() => {
        router.back();
      }}>
      {t("common.back")}
    </Button>
  );
};
