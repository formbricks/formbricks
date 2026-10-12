"use client";

import { FoldersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface WorkspaceVisibilityMarkerProps {
  workspaceName: string;
  /** The survey name the marker precedes. */
  children: ReactNode;
}

/**
 * The survey list's mark for a survey everyone in the workspace can see. It sits inside the row's
 * link, so icon and name stay one focus target; the tooltip's first line follows the name for screen
 * readers, so the link is announced as "{name}, Visible to {workspace}".
 */
export const WorkspaceVisibilityMarker = ({
  workspaceName,
  children,
}: Readonly<WorkspaceVisibilityMarkerProps>) => {
  const { t } = useTranslation();
  const label = t("workspace.surveys.visibility.visible_to_workspace", { workspace: workspaceName });

  return (
    <>
      <TooltipRenderer
        triggerClass="mr-1.5 flex shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100"
        className="max-w-xs"
        tooltipContent={
          <div className="space-y-1">
            <p className="font-medium text-slate-800">{label}</p>
            <p className="text-slate-500">
              {t("workspace.surveys.visibility.visible_to_workspace_description", {
                workspace: workspaceName,
              })}
            </p>
          </div>
        }>
        <FoldersIcon className="size-4" aria-hidden="true" />
      </TooltipRenderer>
      {children}
      <span className="sr-only">{`, ${label}`}</span>
    </>
  );
};
