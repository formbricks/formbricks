"use client";

import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { WorkflowStatusPill } from "@/modules/workflows/components/workflow-status-pill";
import { getWorkflow } from "@/modules/workflows/lib/api-client";
import { workflowKeys } from "@/modules/workflows/lib/query";
import { setWorkflowNameAtom, workflowAtom, workflowNameAtom } from "@/modules/workflows/state/editor";

interface WorkflowPageTitleProps {
  workflowId: string;
  isReadOnly: boolean;
}

// Prefers the atom state hydrated by the builder. On a fresh load of a sub-route like /runs the
// builder never mounts to hydrate the atom, so fetch the name directly; the query stays disabled
// once the atom carries a name, so the builder page never double-fetches.
//
// On the edit tab the title doubles as the name editor: it binds to the same draft atom as the
// Settings panel and is persisted by the header Save. A workflow arriving from the dialog-less
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

  const { data } = useQuery({
    queryKey: workflowKeys.detail(workflowId),
    queryFn: ({ signal }) => getWorkflow(workflowId, signal),
    enabled: !workflow?.name,
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
  if (!resolved) return null;

  // flex-wrap keeps the badge inline next to the name and pushes it below on narrow widths.
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {isEditable ? (
        <input
          ref={inputRef}
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          aria-label={t("common.workflow_name")}
          placeholder={t("common.workflow_name")}
          // Approximates content sizing where field-sizing is unsupported (Firefox/Safari).
          size={Math.max(workflowName.length, 12)}
          className={cn(
            "-mx-2 -my-1 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1",
            "text-3xl font-bold text-slate-800 placeholder:text-slate-400",
            // Sizes to its content where supported; the max keeps long names from pushing the CTA out.
            "[field-sizing:content] max-w-[28rem]",
            "hover:border-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 focus:outline-none"
          )}
        />
      ) : (
        <span className="min-w-0">{resolved.name}</span>
      )}
      <WorkflowStatusPill status={resolved.status} size="large" />
    </span>
  );
};
