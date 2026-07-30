"use client";

import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { PencilIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { WorkflowStatusPill } from "@/modules/ee/workflows/components/workflow-status-pill";
import { getWorkflow } from "@/modules/ee/workflows/lib/api-client";
import { workflowKeys } from "@/modules/ee/workflows/lib/query";
import { setWorkflowNameAtom, workflowAtom, workflowNameAtom } from "@/modules/ee/workflows/state/editor";
import { Skeleton } from "@/modules/ui/components/skeleton";

interface WorkflowPageTitleProps {
  workflowId: string;
  isReadOnly: boolean;
}

// The layout renders PageHeader server-side while the workflow is still being fetched client-side.
// Without a placeholder the h1 collapses to an empty row, so the title area reads as blank and the
// tabs below jump once the name arrives. h-9 matches the text-3xl line box the name will occupy.
const WorkflowPageTitleSkeleton = () => (
  <span className="flex h-9 items-center gap-x-3">
    <Skeleton className="h-7 w-64 rounded-md" />
    <Skeleton className="h-7 w-24 rounded-full" />
  </span>
);

// Prefers the atom state hydrated by the builder. On a fresh load of a sub-route like /runs the
// builder never mounts to hydrate the atom, so fetch the name directly; the query stays disabled
// once the atom carries a name, so the builder page never double-fetches.
//
// On the edit tab the title doubles as the name editor: it binds to the draft atom and is
// persisted by the page-level autosave. A workflow arriving from the dialog-less
// create flow (?new=1) gets the title focused and selected so the user names it immediately.
export const WorkflowPageTitle = ({ workflowId, isReadOnly }: Readonly<WorkflowPageTitleProps>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workflow = useAtomValue(workflowAtom);
  const workflowName = useAtomValue(workflowNameAtom);
  const setWorkflowName = useSetAtom(setWorkflowNameAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoFocusedRef = useRef(false);
  const isNew = searchParams.get("new") === "1";

  // Scoped to sub-routes like /runs, where no builder mounts to hydrate the atom. On the edit tab
  // this used to race the builder's own load: whichever landed first won, and the query usually
  // did — painting the plain-text title, then swapping in the editor (and its pencil) a moment
  // later. Waiting for the single source keeps the header still and drops a duplicate GET.
  const { data } = useQuery({
    queryKey: workflowKeys.detail(workflowId),
    queryFn: ({ signal }) => getWorkflow(workflowId, signal),
    enabled: segment !== null && !workflow?.name,
  });

  // Only the edit tab mounts the builder that hydrates (and saves) the draft name; metadata is
  // editable in every status except archived — the same gate as canEditMetadata in the builder.
  const isEditable = segment === null && Boolean(workflow) && !isReadOnly && workflow?.status !== "archived";

  useEffect(() => {
    if (!isNew || !isEditable || hasAutoFocusedRef.current) return;
    hasAutoFocusedRef.current = true;
    inputRef.current?.focus();
    inputRef.current?.select();
    // Consume the one-shot flag so a reload or shared link doesn't re-select the title.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("new");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [isNew, isEditable, searchParams, router, pathname]);

  const resolved = workflow ?? data;
  if (!resolved) return <WorkflowPageTitleSkeleton />;

  // flex-wrap keeps the badge inline next to the name and pushes it below on narrow widths.
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {isEditable ? (
        // The label wraps the field so the whole box — pencil included — reads and behaves as one
        // control: the border lives here, and clicking anywhere in it focuses the input.
        <label
          className={cn(
            "group -mx-2 -my-1 inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1",
            // Dashed hover/focus box, matching the dashboard's editable title
            // (see dashboard-page-header.tsx): slate while hovered, brand while editing.
            "border border-dashed border-transparent transition-colors",
            "focus-within:border-brand-dark hover:border-slate-300",
            // Same specificity means source order decides, and Tailwind emits hover last — without
            // this the border drops back to slate when the pointer rests on a focused field.
            "focus-within:hover:border-brand-dark"
          )}>
          <input
            ref={inputRef}
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            aria-label={t("common.workflow_name")}
            placeholder={t("common.workflow_name")}
            // Approximates content sizing where field-sizing is unsupported (Firefox/Safari).
            size={Math.max(workflowName.length, 12)}
            className={cn(
              "min-w-0 border-0 bg-transparent p-0",
              "text-3xl font-bold text-slate-800 placeholder:text-slate-400",
              // Sizes to its content where supported; the max keeps long names from pushing the CTA out.
              "[field-sizing:content] max-w-[26rem]",
              "focus:ring-0 focus:outline-none"
            )}
          />
          {/* Standing (not hover-only) affordance that the name is editable. Kept small and muted
              so it stays quieter than the status badge sitting right next to it. */}
          <PencilIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600"
          />
        </label>
      ) : (
        <span className="min-w-0">{resolved.name}</span>
      )}
      <WorkflowStatusPill status={resolved.status} size="large" />
    </span>
  );
};
