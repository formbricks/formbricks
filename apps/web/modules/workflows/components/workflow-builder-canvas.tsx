"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { placeholderWorkflowAction } from "../lib/placeholder-data";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowDetailsPanel } from "./workflow-details-panel";

export const WorkflowBuilderCanvas = () => {
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  return (
    <section
      className={cn(
        "flex min-h-[680px] flex-col transition-[gap] duration-150 ease-out md:flex-row",
        isPanelVisible ? "gap-4" : "gap-0"
      )}>
      <WorkflowCanvas
        isPanelVisible={isPanelVisible}
        onTogglePanel={() => setIsPanelVisible((isVisible) => !isVisible)}
      />
      <WorkflowDetailsPanel action={placeholderWorkflowAction} isVisible={isPanelVisible} />
    </section>
  );
};
