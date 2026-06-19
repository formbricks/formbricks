"use client";

import { useAtomValue } from "jotai";
import { workflowAtom, workflowNameAtom } from "@/modules/workflows/state/editor";

interface WorkflowPageTitleProps {
  fallback: string;
}

export const WorkflowPageTitle = ({ fallback }: Readonly<WorkflowPageTitleProps>) => {
  const workflow = useAtomValue(workflowAtom);
  const workflowName = useAtomValue(workflowNameAtom);
  return <>{workflow ? workflowName : fallback}</>;
};
