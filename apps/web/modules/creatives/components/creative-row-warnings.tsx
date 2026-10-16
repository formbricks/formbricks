"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CreativeWarningZodType } from "@formbricks/api-v3-schemas";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CreativeRowWarningsProps {
  warnings: CreativeWarningZodType[];
  /** Names of the Active creatives this one could overlap on the same page. */
  overlapNames: string[];
}

/** The warning icon on a list row that needs attention, with every reason in its tooltip. */
export const CreativeRowWarnings = ({ warnings, overlapNames }: Readonly<CreativeRowWarningsProps>) => {
  const { t } = useTranslation();
  // The API may add warning codes; an unknown one shows the API's own message.
  const messages: Partial<Record<string, string>> = {
    destinationMissing: t("workspace.creatives.warning_destination_missing"),
    destinationNotAllowed: t("workspace.creatives.warning_destination_not_allowed"),
    actionMissing: t("workspace.creatives.warning_action_missing"),
  };
  const lines = warnings.map((warning) => messages[warning.code] ?? warning.message);
  if (overlapNames.length > 0) {
    lines.push(
      t("workspace.creatives.warning_overlap", { names: overlapNames.map((name) => `"${name}"`).join(", ") })
    );
  }
  if (lines.length === 0) return null;

  return (
    <TooltipRenderer
      tooltipContent={
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      }
      className="max-w-xs"
      triggerClass="inline-flex shrink-0 cursor-help">
      <TriangleAlertIcon className="size-4 text-amber-500" aria-hidden="true" />
      <span className="sr-only">{lines.join(" ")}</span>
    </TooltipRenderer>
  );
};
