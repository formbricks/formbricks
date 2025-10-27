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
      className="mr-2 h-fit bg-white px-2 py-0 font-sans text-sm text-slate-500"
      onClick={onClick}>
      {t("common.restart")}
      <Repeat2 className="ml-2 h-4 w-4" />
    </Button>
  );
};
