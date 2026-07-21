"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TaxonomyNode, TaxonomyRun } from "@/modules/hub/types";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../../components/unify-config-navigation";
import { useRemoveTaxonomyNode } from "../hooks/use-remove-taxonomy-node";
import { useRenameTaxonomyNode } from "../hooks/use-rename-taxonomy-node";
import { useTaxonomyFields } from "../hooks/use-taxonomy-fields";
import { NODE_RECORD_LIMIT, useTaxonomyNodeRecords } from "../hooks/use-taxonomy-node-records";
import { useTaxonomyRecordCounts } from "../hooks/use-taxonomy-record-counts";
import { useTaxonomyRun } from "../hooks/use-taxonomy-run";
import { useTaxonomyState } from "../hooks/use-taxonomy-state";
import { useTriggerTaxonomyRun } from "../hooks/use-trigger-taxonomy-run";
import { MIN_OPEN_TEXT_RECORDS, computeGate } from "../lib/gate";
import { type TTaxonomyScopeSelection, taxonomyKeys } from "../lib/query";
import { findNodeById, firstTopLevelNodeId } from "../lib/tree";
import { EmbeddingProgressBanner } from "./embedding-progress-banner";
import { TaxonomyControls } from "./taxonomy-controls";
import { TaxonomyDisplay } from "./taxonomy-display/taxonomy-display";
import { TopicsSubtopicsGate } from "./topics-subtopics-gate";

interface TopicsSubtopicsContainerProps {
  workspaceId: string;
  directoryMap: Record<string, string>;
  canWrite: boolean;
}

const runFailureMessageFromCode = (code: TaxonomyRun["error_code"], t: TFunction): string => {
  switch (code) {
    case "insufficient_data":
      return t("workspace.unify.taxonomy_failure_insufficient_data");
    case "service_unavailable":
      return t("workspace.unify.taxonomy_failure_service_unavailable");
    case "generation_failed":
      return t("workspace.unify.taxonomy_failure_generation_failed");
    case "invalid_output":
      return t("workspace.unify.taxonomy_failure_invalid_output");
    case "internal_error":
      return t("workspace.unify.taxonomy_failure_internal_error");
    default:
      // Unknown/absent code (e.g. a future Hub failure code we don't map yet) — a neutral message,
      // not the wrong-tense "failed to start" (the run did start, then failed).
      return t("workspace.unify.taxonomy_failure_generation_failed");
  }
};

export const TopicsSubtopicsContainer = ({
  workspaceId,
  directoryMap,
  canWrite,
}: Readonly<TopicsSubtopicsContainerProps>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const directoryIds = useMemo(() => Object.keys(directoryMap), [directoryMap]);
  const [directoryId, setDirectoryId] = useState(directoryIds[0] ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const [nodeToRemove, setNodeToRemove] = useState<TaxonomyNode | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  const fieldsQuery = useTaxonomyFields({ workspaceId, directoryId });
  const fields = useMemo(() => fieldsQuery.data?.fields ?? [], [fieldsQuery.data]);
  const fieldsUnavailable = fieldsQuery.data?.unavailable ?? false;

  // A single taxonomy always covers all open text in the selected directory.
  const scope = useMemo<TTaxonomyScopeSelection>(
    () => ({ directoryId, scopeType: "directory" }),
    [directoryId]
  );

  const gate = useMemo(
    () =>
      computeGate({
        fields,
        hasDirectories: directoryIds.length > 0,
        isLoading: fieldsQuery.isLoading,
        isError: fieldsQuery.isError,
        unavailable: fieldsUnavailable,
      }),
    [fields, directoryIds.length, fieldsQuery.isLoading, fieldsQuery.isError, fieldsUnavailable]
  );

  const stateQuery = useTaxonomyState({ workspaceId, scope });
  const activeTree = stateQuery.data?.activeTree ?? null;
  const stateUnavailable = stateQuery.data?.unavailable ?? false;
  const activeRunId = activeTree?.run.id ?? null;
  const runs = useMemo(() => stateQuery.data?.runs ?? [], [stateQuery.data]);
  const latestRun = runs[0] ?? null;
  const runningRunId =
    latestRun && (latestRun.status === "pending" || latestRun.status === "running") ? latestRun.id : null;

  const runQuery = useTaxonomyRun({ workspaceId, directoryId, runId: runningRunId });

  // Default-select the first top-level topic when a tree loads (or the previous selection vanished,
  // e.g. after a regenerate produced fresh node ids).
  useEffect(() => {
    const root = activeTree?.root;
    if (!root) {
      return;
    }
    if (selectedNodeId && findNodeById(root, selectedNodeId)) {
      return;
    }
    setSelectedNodeId(firstTopLevelNodeId(root));
  }, [activeTree, selectedNodeId]);

  const selectedNode = useMemo(
    () => findNodeById(activeTree?.root, selectedNodeId),
    [activeTree, selectedNodeId]
  );

  const nodeRecordsQuery = useTaxonomyNodeRecords({ workspaceId, directoryId, nodeId: selectedNodeId });

  // Per-node subtree record counts for the active run, as a node-id → count lookup for the tree/records
  // badges. Keyed on the run id, so a fresh run loads new counts automatically; a node remove that
  // shifts ancestor totals is reconciled by invalidating this query (see handleConfirmRemove).
  const recordCountsQuery = useTaxonomyRecordCounts({ workspaceId, directoryId, runId: activeRunId });
  const recordCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of recordCountsQuery.data ?? []) {
      map.set(entry.node_id, entry.record_count);
    }
    return map;
  }, [recordCountsQuery.data]);

  const triggerMutation = useTriggerTaxonomyRun({ workspaceId, scope });
  const renameMutation = useRenameTaxonomyNode({ workspaceId, scope });
  const removeMutation = useRemoveTaxonomyNode({ workspaceId, scope });

  // Run → tree hand-off: when the polled run reaches a terminal state, refresh the active tree + runs.
  const runStatus = runQuery.data?.status;
  useEffect(() => {
    if (runStatus === "succeeded" || runStatus === "failed" || runStatus === "canceled") {
      void queryClient.invalidateQueries({ queryKey: taxonomyKeys.state(workspaceId, scope) });
    }
  }, [runStatus, queryClient, workspaceId, scope]);

  const isRunning = runningRunId !== null || triggerMutation.isPending;
  // A failed run keeps generation enabled (that is the retry path); only block generation while the
  // taxonomy service itself is unreachable, since a new run can't succeed then anyway.
  const serviceUnavailable = fieldsUnavailable || stateUnavailable;
  const canGenerate = canWrite && !isRunning && !serviceUnavailable;
  const hasActiveTree = Boolean(activeTree?.root?.children?.length);
  // Surface the curated, localized failure message keyed on error_code — but only when there is NO
  // active tree, so a failed *re*generate doesn't drop an error banner over a taxonomy that still works
  // (the toast already gives a transient heads-up). The raw Hub `error` string stays server-side (logs).
  const runFailure =
    latestRun?.status === "failed" && !hasActiveTree
      ? runFailureMessageFromCode(latestRun.error_code, t)
      : null;

  const handleGenerate = () => {
    triggerMutation.mutate(
      {},
      {
        onSuccess: (data) =>
          toast.success(
            data.inProgress
              ? t("workspace.unify.taxonomy_run_in_progress")
              : t("workspace.unify.taxonomy_run_started")
          ),
        // A trigger failure comes back as a raw upstream detail (502 / bad_gateway with the Hub's JSON
        // blob), so show a clean localized message instead of dumping it. The specific failed-run alert
        // (with the exact reason) still renders once /state refetches; raw detail stays in server logs.
        onError: () => toast.error(t("workspace.unify.taxonomy_start_failed")),
      }
    );
  };

  const handleRenameNode = async (nodeId: string, label: string) => {
    try {
      await renameMutation.mutateAsync({ nodeId, label });
      toast.success(t("workspace.unify.taxonomy_rename_success"));
    } catch (error) {
      // Localized message only — never surface the raw upstream detail (see the trigger toast above).
      toast.error(t("workspace.unify.taxonomy_rename_failed"));
      throw error;
    }
  };

  const handleRequestRemove = (node: TaxonomyNode) => {
    setNodeToRemove(node);
    setIsRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = () => {
    if (!nodeToRemove) {
      return;
    }
    const { id } = nodeToRemove;
    setIsRemoveConfirmOpen(false);
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
    removeMutation.mutate(
      { nodeId: id },
      {
        onSuccess: async () => {
          toast.success(t("workspace.unify.taxonomy_remove_success"));
          // Removing a node shifts its ancestors' subtree totals; refetch counts for the active run.
          if (activeRunId) {
            await queryClient.invalidateQueries({
              queryKey: taxonomyKeys.recordCounts(workspaceId, directoryId, activeRunId),
            });
          }
        },
        onError: () => toast.error(t("workspace.unify.taxonomy_remove_failed")),
      }
    );
  };

  const header = (
    <PageHeader pageTitle={t("workspace.unify.feedback_data")}>
      <UnifyConfigNavigation workspaceId={workspaceId} activeId="taxonomy" />
    </PageHeader>
  );

  if (gate.gateVariant) {
    return (
      <PageContentWrapper>
        {header}
        <TopicsSubtopicsGate
          variant={gate.gateVariant}
          workspaceId={workspaceId}
          current={
            gate.gateVariant === "insufficient" ? gate.totalOpenTextRecords : gate.totalEmbeddedRecords
          }
          total={gate.gateVariant === "insufficient" ? MIN_OPEN_TEXT_RECORDS : gate.totalOpenTextRecords}
          directoryMap={directoryMap}
          directoryId={directoryId}
          onDirectoryChange={setDirectoryId}
        />
      </PageContentWrapper>
    );
  }

  return (
    <PageContentWrapper>
      {header}

      <div className="space-y-4">
        <TaxonomyControls
          directoryMap={directoryMap}
          directoryIds={directoryIds}
          directoryId={directoryId}
          onDirectoryChange={setDirectoryId}
          embeddedCount={gate.totalEmbeddedRecords}
          textRecordCount={gate.totalOpenTextRecords}
          isLoadingFields={fieldsQuery.isLoading}
          hasActiveTree={hasActiveTree}
          canGenerate={canGenerate}
          isGenerating={isRunning}
          onGenerate={handleGenerate}
          canWrite={canWrite}
        />

        {gate.showInlineProgress && (
          <EmbeddingProgressBanner current={gate.totalEmbeddedRecords} total={gate.totalOpenTextRecords} />
        )}

        {serviceUnavailable && (
          <Alert variant="error" size="small">
            <AlertTitle>{t("workspace.unify.taxonomy_service_unavailable")}</AlertTitle>
            <AlertButton
              onClick={() => {
                void fieldsQuery.refetch();
                void stateQuery.refetch();
              }}>
              {t("common.retry")}
            </AlertButton>
          </Alert>
        )}

        {fieldsQuery.isError && (
          <Alert variant="error" size="small">
            <AlertTitle>{t("common.something_went_wrong_please_try_again")}</AlertTitle>
            <AlertButton onClick={() => void fieldsQuery.refetch()}>{t("common.retry")}</AlertButton>
          </Alert>
        )}

        {runFailure && (
          <Alert variant="error" size="small">
            <AlertDescription>{runFailure}</AlertDescription>
          </Alert>
        )}

        {/* A run is in progress but its status poll is failing. Polling self-recovers (see
         * useTaxonomyRun), so surface a soft warning + manual retry rather than a hard error. */}
        {isRunning && runQuery.isError && (
          <Alert variant="warning" size="small">
            <AlertTitle>{t("common.something_went_wrong_please_try_again")}</AlertTitle>
            <AlertButton onClick={() => void runQuery.refetch()}>{t("common.retry")}</AlertButton>
          </Alert>
        )}

        <TaxonomyDisplay
          activeTree={activeTree}
          hasScope={scope !== null}
          isLoadingTree={fieldsQuery.isLoading || stateQuery.isLoading}
          isFetchingTree={stateQuery.isFetching}
          isTreeError={stateQuery.isError}
          onRetryTree={() => void stateQuery.refetch()}
          selectedNode={selectedNode}
          selectedNodeId={selectedNodeId}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          canWrite={canWrite}
          onSelectNode={(node) => setSelectedNodeId(node.id)}
          onRenameNode={handleRenameNode}
          onRequestRemoveNode={handleRequestRemove}
          recordCounts={recordCounts}
          records={nodeRecordsQuery.data?.records ?? []}
          recordsLimit={nodeRecordsQuery.data?.limit ?? NODE_RECORD_LIMIT}
          isLoadingRecords={nodeRecordsQuery.isLoading}
          isFetchingRecords={nodeRecordsQuery.isFetching}
          isRecordsError={nodeRecordsQuery.isError}
          onRetryRecords={() => void nodeRecordsQuery.refetch()}
        />
      </div>

      <ConfirmationModal
        open={isRemoveConfirmOpen}
        setOpen={setIsRemoveConfirmOpen}
        title={t("workspace.unify.taxonomy_remove_confirm_title")}
        description={t("workspace.unify.taxonomy_remove_confirm_description")}
        body={t("workspace.unify.taxonomy_remove_confirm_body", { keyword: nodeToRemove?.label ?? "" })}
        buttonText={t("workspace.unify.taxonomy_remove")}
        buttonVariant="destructive"
        buttonLoading={removeMutation.isPending}
        onConfirm={handleConfirmRemove}
      />
    </PageContentWrapper>
  );
};
