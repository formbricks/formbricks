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
 * What stays of a collapsed side panel (review point 5, as in Attio and the approved mockup): a pill
 * floating in the canvas's corner on the panel's side, with the panel's icon and name (the open step,
 * or "Runs"), an optional status dot (a run's or step's result) and the expand icon. The whole pill is
 * one button, so a click anywhere on it brings the panel back.
 */
export const WorkflowPanelPill = ({
  side,
  icon,
  label,
  status,
  onExpand,
}: Readonly<{
  side: TPanelSide;
  /** Without one, the status dot leads the label. */
  icon?: ReactNode;
  label: string;
  status?: "success" | "error" | "gray";
  onExpand: () => void;
}>) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`${t("workspace.workflows.expand_panel")}: ${label}`}
      title={t("workspace.workflows.expand_panel")}
      className={cn(
        "absolute top-3 z-10 flex max-w-[300px] items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1.5 text-left shadow-md transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-none",
        side === "right" ? "right-3" : "left-3",
        icon ? "pr-2" : "pr-2 pl-3"
      )}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {status && !icon ? <PillStatusDot status={status} /> : null}
      <span className="truncate text-sm font-semibold text-slate-900">{label}</span>
      {status && icon ? <PillStatusDot status={status} /> : null}
      <span className="flex size-6 shrink-0 items-center justify-center text-slate-500" aria-hidden="true">
        {side === "right" ? (
          <PanelRightOpenIcon className="size-4" />
        ) : (
          <PanelLeftOpenIcon className="size-4" />
        )}
      </span>
    </button>
  );
};

const PillStatusDot = ({ status }: Readonly<{ status: "success" | "error" | "gray" }>) => (
  <span
    aria-hidden="true"
    className={cn(
      "size-2 shrink-0 rounded-full",
      status === "success" && "bg-emerald-500",
      status === "error" && "bg-red-500",
      status === "gray" && "bg-slate-300"
    )}
  />
);
