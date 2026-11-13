import type { ReactNode } from "react";
import { WorkflowSecondaryNavigation } from "@/modules/ee/workflows/components/workflow-secondary-navigation";

interface WorkflowEditorFrameProps {
  workspaceId: string;
  workflowId: string;
  header: ReactNode;
  children: ReactNode;
}

/**
 * The full-screen frame of a workflow (ED8): no app sidebar, the Creatives-style header bar, the
 * Editor / Runs tab row under it, and the tab's content filling what is left. Height is derived from
 * the editor route group's `h-screen` column, so the canvas and inspector scroll inside it, never
 * the page.
 */
export const WorkflowEditorFrame = ({
  workspaceId,
  workflowId,
  header,
  children,
}: Readonly<WorkflowEditorFrameProps>) => (
  <div className="flex h-full flex-col">
    {header}
    <div className="shrink-0 border-b border-slate-200 bg-white px-4">
      <WorkflowSecondaryNavigation workspaceId={workspaceId} workflowId={workflowId} />
    </div>
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</main>
  </div>
);
