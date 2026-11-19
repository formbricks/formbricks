"use client";

import { useReactFlow } from "@xyflow/react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  HandIcon,
  type LucideIcon,
  MousePointerClickIcon,
  NetworkIcon,
  ScanIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TWorkflowCanvasDirection } from "@/modules/ee/workflows/lib/canvas-geometry";
import { Button, type ButtonProps } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CanvasControlsProps {
  canMutate: boolean;
  /** Pan mode = pan/browse only (nodes inert); pointer mode = select/inspect nodes, edit when permitted. */
  isPanMode: boolean;
  /** Which way the canvas reads; the layout menu's tree icon turns to match. */
  direction: TWorkflowCanvasDirection;
  onAutoLayout: () => void;
  /** Fits the whole flow into view. The canvas never does this on its own once it has opened. */
  onFitView: () => void;
  onToggleDirection: () => void;
  onPanMode: () => void;
  onPointerMode: () => void;
}

interface ControlDescriptor {
  key: string;
  Icon: LucideIcon;
  // Resolved label string — labels are translated via inline `t("…")` calls in the descriptor
  // list below so `pnpm scan-translations` can statically detect every key. Indirecting through
  // a variable key (e.g. `t(labelKey)`) silently breaks the scanner.
  label: string;
  variant: ButtonProps["variant"];
  ariaPressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** One control: an icon button with its label as tooltip and accessible name. */
const ControlButton = ({
  Icon,
  label,
  variant,
  ariaPressed,
  disabled,
  onClick,
}: Readonly<ControlDescriptor>) => (
  <TooltipRenderer tooltipContent={label}>
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-label={label}
      aria-pressed={ariaPressed}
      disabled={disabled}
      // Opaque, so the cards underneath never show through the buttons.
      className={cn("shadow-sm", variant === "outline" && "bg-white hover:bg-slate-50")}
      onClick={onClick}>
      <Icon />
    </Button>
  </TooltipRenderer>
);

/** The row of canvas controls, centred at the canvas's bottom edge (editor and Runs view alike). */
export const CanvasControlsBar = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
    <div className="pointer-events-auto flex items-center gap-2">{children}</div>
  </div>
);

/** Zoom in, zoom out and fit the whole flow: the controls every canvas has, read-only ones too. */
export const CanvasZoomControls = ({ onFitView }: Readonly<{ onFitView: () => void }>) => {
  const { t } = useTranslation();
  const { zoomIn, zoomOut } = useReactFlow();
  const controls: ControlDescriptor[] = [
    {
      key: "zoom-in",
      Icon: ZoomInIcon,
      label: t("workspace.workflows.zoom_in"),
      variant: "outline",
      onClick: () => zoomIn(),
    },
    {
      key: "zoom-out",
      Icon: ZoomOutIcon,
      label: t("workspace.workflows.zoom_out"),
      variant: "outline",
      onClick: () => zoomOut(),
    },
    {
      key: "fit-view",
      Icon: ScanIcon,
      label: t("workspace.workflows.fit_view"),
      variant: "outline",
      onClick: onFitView,
    },
  ];
  return (
    <>
      {controls.map(({ key, ...control }) => (
        <ControlButton key={key} {...control} />
      ))}
    </>
  );
};

export const CanvasControls = ({
  canMutate,
  isPanMode,
  direction,
  onAutoLayout,
  onFitView,
  onToggleDirection,
  onPanMode,
  onPointerMode,
}: Readonly<CanvasControlsProps>) => {
  const { t } = useTranslation();
  const isHorizontal = direction === "horizontal";

  const modeControls: ControlDescriptor[] = [
    {
      key: "pan-mode",
      Icon: HandIcon,
      label: t("workspace.workflows.pan_mode"),
      variant: isPanMode ? "default" : "outline",
      ariaPressed: isPanMode,
      onClick: onPanMode,
    },
    {
      key: "pointer-mode",
      Icon: MousePointerClickIcon,
      label: t("workspace.workflows.pointer_mode"),
      variant: isPanMode ? "outline" : "default",
      ariaPressed: !isPanMode,
      onClick: onPointerMode,
    },
  ];

  return (
    <CanvasControlsBar>
      <CanvasZoomControls onFitView={onFitView} />
      {modeControls.map(({ key, ...control }) => (
        <ControlButton key={key} {...control} />
      ))}
      {/* Layout: re-arrange the steps, or switch which way the canvas reads. The tree icon turns
            with the orientation. */}
      <DropdownMenu>
        <TooltipRenderer tooltipContent={t("workspace.workflows.layout")} triggerClass="flex">
          <DropdownMenuTrigger asChild disabled={!canMutate}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="bg-white shadow-sm hover:bg-slate-50"
              aria-label={t("workspace.workflows.layout")}
              disabled={!canMutate}>
              <NetworkIcon
                className={cn(
                  "transition-transform duration-200 motion-reduce:transition-none",
                  isHorizontal && "-rotate-90"
                )}
              />
            </Button>
          </DropdownMenuTrigger>
        </TooltipRenderer>
        <DropdownMenuContent side="top" align="center" className="motion-reduce:animate-none">
          <DropdownMenuItem onClick={onAutoLayout}>
            <NetworkIcon className={cn("size-4", isHorizontal && "-rotate-90")} />
            {t("workspace.workflows.auto_layout")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleDirection}>
            {isHorizontal ? <ArrowDownIcon className="size-4" /> : <ArrowRightIcon className="size-4" />}
            {isHorizontal
              ? t("workspace.workflows.canvas_direction_to_vertical")
              : t("workspace.workflows.canvas_direction_to_horizontal")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CanvasControlsBar>
  );
};
