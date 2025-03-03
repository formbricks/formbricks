"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const BackButton = () => {
  const router = useRouter();
  const { t } = useTranslate();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        router.back();
      }}>
      <ArrowLeftIcon />
      {t("common.back")}
    </Button>
  );
};
