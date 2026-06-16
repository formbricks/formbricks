"use client";

import { PlayIcon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { type TPlaceholderWorkflowBuilderBadge } from "../lib/placeholder-data";

interface WorkflowHeaderCtaProps {
  isReadOnly: boolean;
  badge: TPlaceholderWorkflowBuilderBadge;
}

export const WorkflowHeaderCta = ({ isReadOnly, badge }: Readonly<WorkflowHeaderCtaProps>) => {
  const { t } = useTranslation();
  // Builder actions only belong to the edit tab (the index segment); the runs tab has no CTA.
  const segment = useSelectedLayoutSegment();

  if (segment !== null) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge text={badge.label} type={badge.type} size="normal" />
      <Button type="button" variant="secondary" size="sm" disabled={isReadOnly}>
        <PlayIcon />
        {t("common.test")}
      </Button>
      <Button type="button" variant="secondary" size="sm" disabled={isReadOnly}>
        {t("common.save")}
      </Button>
      <Button type="button" size="sm" disabled={isReadOnly}>
        {t("common.enable")}
      </Button>
    </div>
  );
};
