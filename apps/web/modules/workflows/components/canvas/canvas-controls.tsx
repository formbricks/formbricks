"use client";

import { useReactFlow } from "@xyflow/react";
import { HandIcon, type LucideIcon, MousePointerClickIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, type ButtonProps } from "@/modules/ui/components/button";

interface CanvasControlsProps {
  isEditable: boolean;
  isPanMode: boolean;
  onAutoLayout: () => void;
  onTogglePanMode: () => void;
}

interface ControlDescriptor {
  key: string;
  Icon: LucideIcon;
  labelKey: string;
  variant: ButtonProps["variant"];
  ariaPressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Custom canvas controls matching the Figma design — bottom-center cluster of four buttons:
 * zoom-in, zoom-out, pan tool, and an "auto layout" (magic) trigger. Replaces React Flow's
 * default `<Controls>` so we can match the visual treatment.
 */
export const CanvasControls = ({
  isEditable,
  isPanMode,
  onAutoLayout,
  onTogglePanMode,
}: Readonly<CanvasControlsProps>) => {
  const { t } = useTranslation();
  const { zoomIn, zoomOut } = useReactFlow();

  const controls: ControlDescriptor[] = [
    {
      key: "zoom-in",
      Icon: ZoomInIcon,
      labelKey: "workspace.workflows.zoom_in",
      variant: "outline",
      onClick: () => zoomIn(),
    },
    {
      key: "zoom-out",
      Icon: ZoomOutIcon,
      labelKey: "workspace.workflows.zoom_out",
      variant: "outline",
      onClick: () => zoomOut(),
    },
    {
      key: "pan",
      Icon: HandIcon,
      labelKey: "workspace.workflows.pan",
      variant: isPanMode ? "default" : "outline",
      ariaPressed: isPanMode,
      onClick: onTogglePanMode,
    },
    {
      key: "auto-layout",
      Icon: MousePointerClickIcon,
      labelKey: "workspace.workflows.auto_layout",
      variant: "default",
      disabled: !isEditable,
      onClick: onAutoLayout,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2">
        {controls.map(({ key, Icon, labelKey, variant, ariaPressed, disabled, onClick }) => {
          const label = t(labelKey);
          return (
            <Button
              key={key}
              type="button"
              variant={variant}
              size="icon"
              aria-label={label}
              aria-pressed={ariaPressed}
              title={label}
              disabled={disabled}
              onClick={onClick}>
              <Icon />
            </Button>
          );
        })}
      </div>
    </div>
  );
};
