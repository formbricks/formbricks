"use client";

import { Repeat2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface ResetProgressButtonProps {
  onClick: () => void;
}

export const ResetProgressButton = ({ onClick }: ResetProgressButtonProps) => {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      className="reset-progress-btn mr-2 h-fit px-2 py-0 font-sans text-sm"
      onClick={onClick}>
      {t("common.restart")}
      <Repeat2 className="ml-2 h-4 w-4" />
    </Button>
  );
};
