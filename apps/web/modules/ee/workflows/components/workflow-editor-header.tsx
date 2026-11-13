"use client";

import { ArrowLeftIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WorkflowHeaderCta } from "@/modules/ee/workflows/components/workflow-header-cta";
import { WorkflowPageTitle } from "@/modules/ee/workflows/components/workflow-page-title";
import { Button } from "@/modules/ui/components/button";

const HeaderBar = ({
  workspaceId,
  title,
  actions,
}: {
  readonly workspaceId: string;
  readonly title: ReactNode;
  readonly actions?: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    // Copies the Creatives editor bar (creative-editor.tsx): ghost back button, the name edited in
    // place, then the controls pushed to the right.
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-slate-600" asChild>
        <Link href={`/workspaces/${workspaceId}/workflows`} aria-label={t("common.back")}>
          <ArrowLeftIcon />
        </Link>
      </Button>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <WorkflowIcon className="size-4" aria-hidden="true" />
        </span>
        {title}
      </div>
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
};

interface WorkflowEditorHeaderProps {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
  /**
   * Starts a Test run of the draft. Until the Test run slice wires it the button shows but stays
   * disabled. The server layout can't pass a function, so it is meant to come from the client hook
   * below, not from a prop the layout sets.
   */
  onTestRun?: () => void;
}

/** The header of a workflow: back to the list, name in place, status pill, auto-save, Test run, status menu. */
export const WorkflowEditorHeader = ({
  workspaceId,
  workflowId,
  isReadOnly,
  onTestRun,
}: Readonly<WorkflowEditorHeaderProps>) => {
  // TEST RUN HOOK-UP (ENG-7182 part B): call `useWorkflowTestRun(workflowId)` here and pass its
  // start function as `handleTestRun`; the run drawer it opens is that slice's.
  const handleTestRun = onTestRun;

  return (
    <HeaderBar
      workspaceId={workspaceId}
      title={<WorkflowPageTitle workflowId={workflowId} isReadOnly={isReadOnly} />}
      actions={
        <WorkflowHeaderCta workflowId={workflowId} isReadOnly={isReadOnly} onTestRun={handleTestRun} />
      }
    />
  );
};

/** The same bar with a fixed title, for an organization without Workflows. */
export const WorkflowEditorPlainHeader = ({
  workspaceId,
  title,
}: Readonly<{ workspaceId: string; title: string }>) => (
  <HeaderBar
    workspaceId={workspaceId}
    title={<span className="truncate text-base font-semibold text-slate-900">{title}</span>}
  />
);
