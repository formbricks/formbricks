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

/**
 * What stays of the collapsed step panel (review point 5, as in Attio and the approved mockup): a pill
 * floating at the canvas's top-right with the step's icon and name and the expand button, so the
 * canvas gets its full width back and still says which step is open. `status` is an optional dot
 * (the Runs view's step result).
 */
export const WorkflowPanelPill = ({
  icon,
  label,
  status,
  onExpand,
}: Readonly<{
  icon: ReactNode;
  label: string;
  status?: "success" | "error" | "gray";
  onExpand: () => void;
}>) => {
  const { t } = useTranslation();
  return (
    <div className="absolute top-3 right-3 z-10 flex max-w-[300px] items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-1 pl-1.5 shadow-md">
      <button
        type="button"
        onClick={onExpand}
        className="flex min-w-0 items-center gap-2 rounded-full text-left"
        title={label}>
        <span className="shrink-0">{icon}</span>
        <span className="truncate text-sm font-semibold text-slate-900">{label}</span>
      </button>
      {status ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            status === "success" && "bg-emerald-500",
            status === "error" && "bg-red-500",
            status === "gray" && "bg-slate-300"
          )}
        />
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 rounded-full text-slate-500"
        aria-label={t("workspace.workflows.expand_panel")}
        title={t("workspace.workflows.expand_panel")}
        onClick={onExpand}>
        <PanelRightOpenIcon />
      </Button>
    </div>
  );
};
