import type { ReactNode } from "react";
import { WorkflowsQueryClientProvider } from "./query-client-provider";

const WorkflowsLayout = ({ children }: { children: ReactNode }) => {
  return <WorkflowsQueryClientProvider>{children}</WorkflowsQueryClientProvider>;
};

export default WorkflowsLayout;
