"use client";

import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface WorkflowCanvasProps {
  isPanelVisible: boolean;
  onTogglePanel: () => void;
}

export const WorkflowCanvas = ({ isPanelVisible, onTogglePanel }: Readonly<WorkflowCanvasProps>) => {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-[680px] min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]">
      <div className="absolute right-4 top-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="size-8 p-0"
          aria-label={t("common.settings")}
          aria-expanded={isPanelVisible}
          onClick={onTogglePanel}>
          {isPanelVisible ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
          <span className="sr-only">{t("common.settings")}</span>
        </Button>
      </div>
    </div>
  );
};
