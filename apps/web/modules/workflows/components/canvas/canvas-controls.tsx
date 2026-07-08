"use client";

import { useReactFlow } from "@xyflow/react";
import {
  LockIcon,
  type LucideIcon,
  MousePointerClickIcon,
  PlusIcon,
  UnlockIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, type ButtonProps } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CanvasControlsProps {
  canEdit: boolean;
  canMutate: boolean;
  isLocked: boolean;
  onAutoLayout: () => void;
  onToggleLock: () => void;
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
  canEdit,
  canMutate,
  isLocked,
  onAutoLayout,
  onToggleLock,
}: Readonly<CanvasControlsProps>) => {
  const { t } = useTranslation();
  const { zoomIn, zoomOut } = useReactFlow();

  const lockLabel = isLocked ? t("workspace.workflows.unlock_canvas") : t("workspace.workflows.lock_canvas");

  const controls: ControlDescriptor[] = [
    {
      key: "add-node",
      Icon: PlusIcon,
      label: t("workspace.workflows.add_node"),
      variant: "outline",
      // Placeholder — node insertion from the toolbar isn't wired up yet.
      disabled: true,
      onClick: () => {},
    },
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
      key: "auto-layout",
      Icon: MousePointerClickIcon,
      label: t("workspace.workflows.auto_layout"),
      variant: "outline",
      disabled: !canMutate,
      onClick: onAutoLayout,
    },
    {
      key: "lock",
      Icon: isLocked ? LockIcon : UnlockIcon,
      label: lockLabel,
      variant: isLocked ? "default" : "outline",
      ariaPressed: !isLocked,
      // Keep clickable while the workflow is enabled so the click can surface the
      // "disable first" toast — the actual gate sits in the parent's handleToggleLock.
      disabled: isLocked ? false : !canEdit,
      onClick: onToggleLock,
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
