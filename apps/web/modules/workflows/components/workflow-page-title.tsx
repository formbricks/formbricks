"use client";

import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { WorkflowStatusPill } from "@/modules/workflows/components/workflow-status-pill";
import { getWorkflow } from "@/modules/workflows/lib/api-client";
import { workflowKeys } from "@/modules/workflows/lib/query";
import { workflowAtom } from "@/modules/workflows/state/editor";

interface WorkflowPageTitleProps {
  workflowId: string;
}

// Prefers the persisted name from `workflowAtom` (hydrated by the builder, NOT the live draft, so
// typing in the inspector leaves the title alone until Save resolves). On a fresh load of a
// sub-route like /runs the builder never mounts to hydrate the atom, so fetch the name directly;
// the query stays disabled once the atom carries a name, so the builder page never double-fetches.
export const WorkflowPageTitle = ({ workflowId }: Readonly<WorkflowPageTitleProps>) => {
  const workflow = useAtomValue(workflowAtom);
  const { data } = useQuery({
    queryKey: workflowKeys.detail(workflowId),
    queryFn: ({ signal }) => getWorkflow(workflowId, signal),
    enabled: !workflow?.name,
  });

  const resolved = workflow ?? data;
  if (!resolved) return null;

  // flex-wrap keeps the badge inline next to the name and pushes it below on narrow widths.
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="min-w-0">{resolved.name}</span>
      <WorkflowStatusPill status={resolved.status} size="large" />
    </span>
  );
};
