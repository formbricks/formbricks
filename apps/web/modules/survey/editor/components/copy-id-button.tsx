"use client";

import { CopyIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CopyIdButtonProps {
  /** The ID that is copied. It is shown in the tooltip, so the read-only ID is visible too. */
  id: string;
  label: string;
}

/** Copies an ID that is read-only in the editor (a question's or an option's) with a toast. */
export const useCopyId = () => {
  const { t } = useTranslation();

  return async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(t("common.copied_to_clipboard"));
    } catch (error) {
      logger.error(error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };
};

/**
 * One button next to an option's input that copies its read-only Option ID (prefill links and the
 * API use it); replaces the old "Option IDs" list.
 */
export const CopyIdButton = ({ id, label }: Readonly<CopyIdButtonProps>) => {
  const copy = useCopyId();

  return (
    <TooltipRenderer
      tooltipContent={
        <span className="flex flex-col">
          <span>{label}</span>
          <span className="font-mono text-xs text-slate-500">{id}</span>
        </span>
      }>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={label}
        data-testid="copy-option-id"
        data-option-id={id}
        onClick={(event) => {
          event.preventDefault();
          void copy(id);
        }}>
        <CopyIcon />
      </Button>
    </TooltipRenderer>
  );
};
