"use client";

import { useAtomValue } from "jotai";
import { workflowAtom } from "@/modules/workflows/state/editor";

interface WorkflowPageTitleProps {
  fallback: string;
}

// Reads the persisted workflow name from `workflowAtom.name`, NOT the live draft
// (`workflowNameAtom`). The header title is meant to reflect what's actually saved on the
// server — typing in the inspector should leave the title alone until Save resolves and
// `setWorkflowAtom` swaps in the server-returned resource.
export const WorkflowPageTitle = ({ fallback }: Readonly<WorkflowPageTitleProps>) => {
  const workflow = useAtomValue(workflowAtom);
  return <>{workflow?.name ?? fallback}</>;
};
