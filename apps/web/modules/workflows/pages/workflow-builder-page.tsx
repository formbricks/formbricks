"use client";

import { WorkflowBuilderCanvas } from "../components/workflow-builder-canvas";
import { type TPlaceholderWorkflowAction } from "../lib/placeholder-data";

interface WorkflowBuilderPageProps {
  action: TPlaceholderWorkflowAction;
}

export const WorkflowBuilderPage = ({ action }: Readonly<WorkflowBuilderPageProps>) => {
  return <WorkflowBuilderCanvas action={action} />;
};
