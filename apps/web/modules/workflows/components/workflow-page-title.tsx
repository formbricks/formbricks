"use client";

import { useAtomValue } from "jotai";
import { workflowAtom } from "@/modules/workflows/state/editor";

// Reads the persisted workflow name from `workflowAtom.name`, NOT the live draft
// (`workflowNameAtom`). The header title is meant to reflect what's actually saved on the
// server — typing in the inspector should leave the title alone until Save resolves and
// `setWorkflowAtom` swaps in the server-returned resource. Names are required so the atom
// always carries a non-empty string once the workflow has loaded.
export const WorkflowPageTitle = () => {
  const workflow = useAtomValue(workflowAtom);
  return <>{workflow?.name}</>;
};
