"use client";

import { PlusIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface WorkspaceWorkflowsHeaderCtaProps {
  isReadOnly: boolean;
}

export const WorkspaceWorkflowsHeaderCta = ({ isReadOnly }: Readonly<WorkspaceWorkflowsHeaderCtaProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();

  // The create CTA only belongs to the workflows list tab (the index segment); the runs tab has no CTA.
  if (segment !== null) {
    return null;
  }

  return (
    <Button type="button" size="sm" disabled={isReadOnly}>
      <PlusIcon />
      {t("common.new_workflow")}
    </Button>
  );
};
