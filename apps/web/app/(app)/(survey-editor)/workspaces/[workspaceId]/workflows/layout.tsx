import type { ReactNode } from "react";
import { WorkflowsQueryClientProvider } from "@/app/(app)/workspaces/[workspaceId]/workflows/query-client-provider";

// The workflow editor lives in the editor route group so it opens without the app sidebar, like the
// Survey and Creatives editors (ED8). The workflow list keeps its own provider in the app shell.
const WorkflowEditorQueryLayout = ({ children }: { readonly children: ReactNode }) => {
  return <WorkflowsQueryClientProvider>{children}</WorkflowsQueryClientProvider>;
};

export default WorkflowEditorQueryLayout;
