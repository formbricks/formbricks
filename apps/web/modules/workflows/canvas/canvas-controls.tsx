"use client";

import { useReactFlow } from "@xyflow/react";
import { HandIcon, MousePointerClickIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface CanvasControlsProps {
  isEditable: boolean;
  isPanMode: boolean;
  onAutoLayout: () => void;
  onTogglePanMode: () => void;
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

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("workspace.workflows.zoom_in")}
          title={t("workspace.workflows.zoom_in")}
          onClick={() => zoomIn()}>
          <ZoomInIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("workspace.workflows.zoom_out")}
          title={t("workspace.workflows.zoom_out")}
          onClick={() => zoomOut()}>
          <ZoomOutIcon />
        </Button>
        <Button
          type="button"
          variant={isPanMode ? "default" : "outline"}
          size="icon"
          aria-label={t("workspace.workflows.pan")}
          aria-pressed={isPanMode}
          title={t("workspace.workflows.pan")}
          onClick={onTogglePanMode}>
          <HandIcon />
        </Button>
        <Button
          type="button"
          size="icon"
          aria-label={t("workspace.workflows.auto_layout")}
          title={t("workspace.workflows.auto_layout")}
          disabled={!isEditable}
          onClick={onAutoLayout}>
          <MousePointerClickIcon />
        </Button>
      </div>
    </div>
  );
};
