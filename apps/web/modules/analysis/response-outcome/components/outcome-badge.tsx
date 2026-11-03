"use client";

import { useTranslation } from "react-i18next";
import type { TResponseOutcome } from "@formbricks/types/responses";
import { Badge } from "@/modules/ui/components/badge";

/** The outcome as a pill. Renders nothing while the response has none: complete is the unmarked state. */
export const OutcomeBadge = ({ outcome }: Readonly<{ outcome: TResponseOutcome | null | undefined }>) => {
  const { t } = useTranslation();
  if (outcome !== "lowQuality") return null;
  return <Badge type="warning" size="normal" text={t("workspace.surveys.responses.low_quality")} />;
};
