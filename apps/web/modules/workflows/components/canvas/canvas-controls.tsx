"use client";

import { useReactFlow } from "@xyflow/react";
import {
  HandIcon,
  type LucideIcon,
  MousePointerClickIcon,
  WandSparklesIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, type ButtonProps } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CanvasControlsProps {
  canMutate: boolean;
  /** Drag mode = pan/browse only (nodes not editable); pointer mode = select and edit nodes. */
  isDragMode: boolean;
  onAutoLayout: () => void;
  onDragMode: () => void;
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

export const CanvasControls = ({
  canMutate,
  isDragMode,
  onAutoLayout,
  onDragMode,
  onPointerMode,
}: Readonly<CanvasControlsProps>) => {
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
      key: "drag-mode",
      Icon: HandIcon,
      label: t("workspace.workflows.drag_mode"),
      variant: isDragMode ? "default" : "outline",
      ariaPressed: isDragMode,
      onClick: onDragMode,
    },
    {
      key: "pointer-mode",
      Icon: MousePointerClickIcon,
      label: t("workspace.workflows.pointer_mode"),
      variant: isDragMode ? "outline" : "default",
      ariaPressed: !isDragMode,
      // Stays clickable while the workflow is enabled so the click can surface the
      // "disable first" toast — the actual gate sits in the parent's onPointerMode.
      onClick: onPointerMode,
    },
    {
      key: "auto-layout",
      Icon: WandSparklesIcon,
      label: t("workspace.workflows.auto_layout"),
      variant: "outline",
      disabled: !canMutate,
      onClick: onAutoLayout,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2">
        {controls.map(({ key, Icon, label, variant, ariaPressed, disabled, onClick }) => (
          <TooltipRenderer key={key} tooltipContent={label}>
            <Button
              type="button"
              variant={variant}
              size="icon"
              aria-label={label}
              aria-pressed={ariaPressed}
              disabled={disabled}
              onClick={onClick}>
              <Icon />
            </Button>
          </TooltipRenderer>
        ))}
      </div>
    </div>
  );
};
