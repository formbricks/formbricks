"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface BackButtonProps {
  path?: string;
}

export const BackButton = ({ path }: BackButtonProps) => {
  const router = useRouter();
  const { t } = useTranslation();
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
