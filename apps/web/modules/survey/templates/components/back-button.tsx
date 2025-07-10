"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  path?: string;
}

export const BackButton = ({ path }: BackButtonProps) => {
  const router = useRouter();
  const { t } = useTranslate();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        if (path) {
          router.push(path);
        } else {
          router.back();
        }
      }}>
      <ArrowLeftIcon />
      {t("common.back")}
    </Button>
  );
};
