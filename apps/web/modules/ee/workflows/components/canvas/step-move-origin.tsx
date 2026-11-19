"use client";

import { ViewportPortal } from "@xyflow/react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { stepMoveDragAtom } from "@/modules/ee/workflows/state/editor";

/** While a step card is dragged, its old place on the canvas: a dashed outline reading "Was here". */
export const StepMoveOrigin = () => {
  const { t } = useTranslation();
  const origin = useAtomValue(stepMoveDragAtom)?.origin;
  if (!origin) return null;
  return (
    <ViewportPortal>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/60 text-xs font-medium text-slate-400"
        style={{
          transform: `translate(${origin.x}px, ${origin.y}px)`,
          width: origin.width,
          height: origin.height,
        }}>
        {t("workspace.workflows.step_move_was_here")}
      </div>
    </ViewportPortal>
  );
};
