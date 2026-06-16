"use client";

import { useState } from "react";
import type { TWorkflowSendEmailActionNode } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowDetailsPanel } from "./workflow-details-panel";

interface WorkflowBuilderCanvasProps {
  action: TWorkflowSendEmailActionNode;
}

export const WorkflowBuilderCanvas = ({ action }: Readonly<WorkflowBuilderCanvasProps>) => {
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
      <WorkflowDetailsPanel action={action} isVisible={isPanelVisible} />
    </section>
  );
};
