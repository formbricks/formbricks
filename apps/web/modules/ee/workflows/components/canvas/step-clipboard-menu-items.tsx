"use client";

import { CopyIcon, ScissorsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStepClipboard } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import { DropdownMenuItem } from "@/modules/ui/components/dropdown-menu";

// Cut and Copy in a step's ⋮ menu. Both take the step and every step after it; a `+` then offers
// "Paste here". ⌘X and ⌘C on the selected step do the same.
export const StepClipboardMenuItems = ({ nodeId }: Readonly<{ nodeId: string }>) => {
  const { t } = useTranslation();
  const { cut, copy } = useStepClipboard();
  return (
    <>
      <DropdownMenuItem
        onClick={(event) => {
          event.stopPropagation();
          cut(nodeId);
        }}>
        <ScissorsIcon className="size-4" />
        {t("workspace.workflows.cut_step")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(event) => {
          event.stopPropagation();
          copy(nodeId);
        }}>
        <CopyIcon className="size-4" />
        {t("workspace.workflows.copy_step")}
      </DropdownMenuItem>
    </>
  );
};
