"use client";

import type { TWorkflowSendEmailActionNode } from "@formbricks/workflows";
import { WorkflowBuilderCanvas } from "../components/workflow-builder-canvas";

interface WorkflowBuilderPageProps {
  action: TWorkflowSendEmailActionNode;
}

export const WorkflowBuilderPage = ({ action }: Readonly<WorkflowBuilderPageProps>) => {
  return <WorkflowBuilderCanvas action={action} />;
};
