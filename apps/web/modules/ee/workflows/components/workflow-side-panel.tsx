"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";

type TPanelSide = "left" | "right";

/**
 * The collapse button of an editor side panel (review point 5): in the panel's own header, next to its
 * title, like the main navigation's, with the icon of the side the panel is on.
 */
export const WorkflowPanelCollapseButton = ({
  side,
  onCollapse,
}: Readonly<{ side: TPanelSide; onCollapse: () => void }>) => {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-slate-500"
      aria-label={t("workspace.workflows.collapse_panel")}
      title={t("workspace.workflows.collapse_panel")}
      onClick={onCollapse}>
      {side === "right" ? <PanelRightCloseIcon /> : <PanelLeftCloseIcon />}
    </Button>
  );
};

/**
 * What stays of a collapsed side panel (review point 5): a narrow rail like the collapsed main
 * navigation, so the panel keeps its place and says what it holds. The expand button is on top; the
 * rail's own content (a step's icon, run dots) follows, then the label written vertically.
 */
export const WorkflowPanelRail = ({
  side,
  label,
  onExpand,
  children,
}: Readonly<{ side: TPanelSide; label: string; onExpand: () => void; children?: ReactNode }>) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex min-h-0 w-[52px] shrink-0 flex-col items-center gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white py-2"
      )}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-slate-500"
        aria-label={t("workspace.workflows.expand_panel")}
        title={t("workspace.workflows.expand_panel")}
        onClick={onExpand}>
        {side === "right" ? <PanelRightOpenIcon /> : <PanelLeftOpenIcon />}
      </Button>
      <div className="h-px w-6 shrink-0 bg-slate-200" aria-hidden="true" />
      {children}
      <button
        type="button"
        onClick={onExpand}
        className="max-h-64 min-h-0 truncate text-xs font-medium text-slate-600 [writing-mode:vertical-rl] hover:text-slate-900"
        style={{ transform: "rotate(180deg)" }}>
        {label}
      </button>
    </div>
  );
};
