"use client";

import type { TFunction } from "i18next";
import {
  ChevronRightIcon,
  FileTextIcon,
  GitBranchIcon,
  Loader2Icon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type {
  TaxonomyFieldOption,
  TaxonomyNode,
  TaxonomyNodeRecordsResponse,
  TaxonomyRun,
  TaxonomyRunFailureCode,
  TaxonomyScope,
  TaxonomyTreeResponse,
} from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/modules/ui/components/sheet";
import { UnifyConfigNavigation } from "../../components/unify-config-navigation";
import {
  getTaxonomyFieldsAction,
  getTaxonomyNodeRecordsAction,
  getTaxonomyRunAction,
  getTaxonomyStateAction,
  getTaxonomyTreeAction,
  removeTaxonomyNodeAction,
  renameTaxonomyNodeAction,
  triggerTaxonomyRunAction,
} from "../actions";

interface TopicsSubtopicsPreviewProps {
  workspaceId: string;
  directoryMap: Record<string, string>;
  canWrite: boolean;
}

const RUNNING_STATUSES = new Set(["pending", "running"]);
const NODE_RECORD_LIMIT = 50;

const fieldKey = (field: TaxonomyFieldOption) =>
  [field.source_type, field.source_id, field.field_id].join("::");

const sourceKey = (field: TaxonomyFieldOption) => [field.source_type, field.source_id].join("::");

const scopeFromField = (field: TaxonomyFieldOption): TaxonomyScope => ({
  tenant_id: field.tenant_id,
  source_type: field.source_type,
  source_id: field.source_id,
  field_id: field.field_id,
});

const statusBadgeType = (status: TaxonomyRun["status"]): "warning" | "success" | "error" | "gray" => {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "canceled") return "error";
  if (status === "pending" || status === "running") return "warning";
  return "gray";
};

const runFailureMessage = (code: TaxonomyRunFailureCode, t: TFunction): string => {
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
  }
};

const runStatusLabel = (status: TaxonomyRun["status"], t: TFunction): string => {
  switch (status) {
    case "pending":
      return t("workspace.unify.taxonomy_status_pending");
    case "running":
      return t("workspace.unify.taxonomy_status_running");
    case "succeeded":
      return t("workspace.unify.taxonomy_status_succeeded");
    case "failed":
      return t("workspace.unify.taxonomy_status_failed");
    case "canceled":
      return t("workspace.unify.taxonomy_status_canceled");
  }
};

const nodeTypeLabel = (nodeType: TaxonomyNode["node_type"], t: TFunction): string => {
  switch (nodeType) {
    case "root":
      return t("workspace.unify.taxonomy_node_type_root");
    case "branch":
      return t("workspace.unify.taxonomy_node_type_branch");
    case "leaf":
      return t("workspace.unify.taxonomy_node_type_leaf");
  }
};

type TaxonomyColumn = {
  level: number;
  nodes: TaxonomyNode[];
};

const findNodePath = (root: TaxonomyNode | null | undefined, nodeId: string): TaxonomyNode[] => {
  if (!root) return [];
  if (root.id === nodeId) return [root];

  for (const child of root.children ?? []) {
    const childPath = findNodePath(child, nodeId);
    if (childPath.length > 0) {
      return [root, ...childPath];
    }
  }

  return [];
};

const firstDeepestNode = (root: TaxonomyNode | null | undefined): TaxonomyNode | null => {
  if (!root) return null;

  let current = root;
  while (current.children?.[0]) {
    current = current.children[0];
  }

  return current;
};

const taxonomyColumnsFromPath = (
  root: TaxonomyNode | null | undefined,
  path: TaxonomyNode[]
): TaxonomyColumn[] => {
  if (!root?.children?.length) return [];

  const columns: TaxonomyColumn[] = [];
  let parent = root;

  while (parent.children?.length) {
    columns.push({
      level: parent.children[0]?.level ?? columns.length + 1,
      nodes: parent.children,
    });

    const nextParent = path.find((node) => node.parent_id === parent.id);
    if (!nextParent) break;

    parent = nextParent;
  }

  return columns;
};

const getNodeRecordEstimate = (node: TaxonomyNode): number | null => {
  const metadata = node.metadata;
  if (!metadata) return null;

  for (const key of ["record_count", "records_count", "cluster_size", "size"]) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

export const TopicsSubtopicsPreview = ({
  workspaceId,
  directoryMap,
  canWrite,
}: Readonly<TopicsSubtopicsPreviewProps>) => {
  const { t } = useTranslation();
  const directoryIds = useMemo(() => Object.keys(directoryMap), [directoryMap]);
  const [directoryId, setDirectoryId] = useState(directoryIds[0] ?? "");
  const [fields, setFields] = useState<TaxonomyFieldOption[]>([]);
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const [selectedFieldKey, setSelectedFieldKey] = useState("");
  const [activeTree, setActiveTree] = useState<TaxonomyTreeResponse | null>(null);
  const [runs, setRuns] = useState<TaxonomyRun[]>([]);
  const [selectedNode, setSelectedNode] = useState<TaxonomyNode | null>(null);
  const [nodeRecords, setNodeRecords] = useState<TaxonomyNodeRecordsResponse["data"]>([]);
  const [editNode, setEditNode] = useState<TaxonomyNode | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [isRecordsDrawerOpen, setIsRecordsDrawerOpen] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sourceOptions = useMemo(() => {
    const options = new Map<string, TaxonomyFieldOption>();
    for (const field of fields) {
      const key = sourceKey(field);
      if (!options.has(key)) {
        options.set(key, field);
      }
    }
    return [...options.values()];
  }, [fields]);

  const filteredFields = useMemo(
    () => fields.filter((field) => sourceKey(field) === selectedSourceKey),
    [fields, selectedSourceKey]
  );

  const selectedField = useMemo(
    () => fields.find((field) => fieldKey(field) === selectedFieldKey) ?? null,
    [fields, selectedFieldKey]
  );

  const selectedScope = useMemo(
    () => (selectedField ? scopeFromField(selectedField) : null),
    [selectedField]
  );
  const runErrorMessage = useCallback(
    (run: TaxonomyRun) => run.error ?? (run.error_code ? runFailureMessage(run.error_code, t) : null),
    [t]
  );
  const latestRun = runs[0] ?? null;
  const latestRunError = latestRun ? runErrorMessage(latestRun) : null;
  const hasRunningRun = latestRun ? RUNNING_STATUSES.has(latestRun.status) : false;
  const canGenerate = Boolean(selectedField && canWrite && !hasRunningRun && !isGenerating);
  const selectedPath = useMemo(
    () => (selectedNode ? findNodePath(activeTree?.root, selectedNode.id) : []),
    [activeTree?.root, selectedNode]
  );
  const selectedPathIds = useMemo(() => new Set(selectedPath.map((node) => node.id)), [selectedPath]);
  const taxonomyColumns = useMemo(
    () => taxonomyColumnsFromPath(activeTree?.root, selectedPath),
    [activeTree?.root, selectedPath]
  );
  const selectedNodeRecordEstimate = selectedNode ? getNodeRecordEstimate(selectedNode) : null;
  const selectedNodeRecordCount =
    selectedNodeRecordEstimate ?? (nodeRecords.length < NODE_RECORD_LIMIT ? nodeRecords.length : null);

  const loadFields = useCallback(
    async (nextDirectoryId: string) => {
      if (!nextDirectoryId) return;

      setIsLoadingFields(true);
      setError(null);
      setNotice(null);
      setFields([]);
      setSelectedSourceKey("");
      setSelectedFieldKey("");
      setActiveTree(null);
      setRuns([]);
      setSelectedNode(null);
      setNodeRecords([]);
      setEditNode(null);
      setIsRecordsDrawerOpen(false);

      try {
        const response = await getTaxonomyFieldsAction({ workspaceId, directoryId: nextDirectoryId });
        if (!response?.data) {
          setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_load_fields_failed"));
          return;
        }

        setFields(response.data.fields);
        if (response.data.unavailable) {
          setNotice(response.data.unavailableMessage ?? t("workspace.unify.taxonomy_fields_unavailable"));
        }

        const firstField = response.data.fields[0];
        if (firstField) {
          setSelectedSourceKey(sourceKey(firstField));
          setSelectedFieldKey(fieldKey(firstField));
        }
      } catch {
        setError(t("workspace.unify.taxonomy_load_fields_failed"));
      } finally {
        setIsLoadingFields(false);
      }
    },
    [t, workspaceId]
  );

  const loadState = useCallback(async () => {
    if (!selectedScope) return;

    setIsLoadingState(true);
    setError(null);
    setNotice(null);
    setSelectedNode(null);
    setNodeRecords([]);
    setEditNode(null);
    setIsRecordsDrawerOpen(false);

    try {
      const response = await getTaxonomyStateAction({ workspaceId, scope: selectedScope });
      if (!response?.data) {
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_load_failed"));
        return;
      }

      setActiveTree(response.data.activeTree);
      setRuns(response.data.runs);
      if (response.data.unavailable) {
        setNotice(response.data.unavailableMessage ?? t("workspace.unify.taxonomy_active_unavailable"));
      }
    } catch {
      setError(t("workspace.unify.taxonomy_load_failed"));
    } finally {
      setIsLoadingState(false);
    }
  }, [selectedScope, t, workspaceId]);

  useEffect(() => {
    void loadFields(directoryId);
  }, [directoryId, loadFields]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!latestRun || !selectedScope || !RUNNING_STATUSES.has(latestRun.status)) return;

    const abortController = new AbortController();

    const interval = window.setInterval(async () => {
      if (abortController.signal.aborted) return;

      const response = await getTaxonomyRunAction({ workspaceId, scope: selectedScope, runId: latestRun.id });
      const run = response?.data;
      if (!run || abortController.signal.aborted) return;

      setRuns((prev) => [run, ...prev.filter((existingRun) => existingRun.id !== run.id)]);
      if (!RUNNING_STATUSES.has(run.status)) {
        if (run.status === "succeeded") {
          const treeResponse = await getTaxonomyTreeAction({
            workspaceId,
            scope: selectedScope,
            runId: run.id,
          });
          if (treeResponse?.data && !abortController.signal.aborted) {
            setActiveTree(treeResponse.data);
          }
        }
        window.clearInterval(interval);
      }
    }, 5000);

    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [latestRun, selectedScope, workspaceId]);

  const handleSourceChange = (value: string) => {
    setSelectedSourceKey(value);
    const firstField = fields.find((field) => sourceKey(field) === value);
    setSelectedFieldKey(firstField ? fieldKey(firstField) : "");
  };

  const handleGenerate = async () => {
    if (!selectedField || !selectedScope) return;

    setIsGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await triggerTaxonomyRunAction({
        workspaceId,
        scope: selectedScope,
        fieldLabel: selectedField.field_label,
      });
      if (!response?.data) {
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_start_failed"));
        return;
      }

      const result = response.data;
      setRuns((prev) => [result.run, ...prev.filter((run) => run.id !== result.run.id)]);
      if (result.inProgress) {
        setNotice(t("workspace.unify.taxonomy_run_in_progress"));
      }
    } catch {
      setError(t("workspace.unify.taxonomy_start_failed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectNode = useCallback(
    async (node: TaxonomyNode) => {
      if (!selectedScope) return;

      setSelectedNode(node);
      setIsLoadingRecords(true);
      setError(null);

      try {
        const response = await getTaxonomyNodeRecordsAction({
          workspaceId,
          tenantId: selectedScope.tenant_id,
          nodeId: node.id,
          limit: 50,
        });
        if (!response?.data) {
          setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_load_records_failed"));
          return;
        }

        setNodeRecords(response.data.data);
      } catch {
        setError(t("workspace.unify.taxonomy_load_records_failed"));
      } finally {
        setIsLoadingRecords(false);
      }
    },
    [selectedScope, t, workspaceId]
  );

  useEffect(() => {
    if (!activeTree?.root || !selectedScope) return;
    if (selectedNode && findNodePath(activeTree.root, selectedNode.id).length > 0) return;

    const defaultNode = firstDeepestNode(activeTree.root);
    if (defaultNode) {
      void handleSelectNode(defaultNode);
    }
  }, [activeTree?.root, handleSelectNode, selectedNode, selectedScope]);

  const reloadTree = async () => {
    if (!activeTree || !selectedScope) return;

    const response = await getTaxonomyTreeAction({
      workspaceId,
      scope: selectedScope,
      runId: activeTree.run.id,
    });
    if (response?.data) {
      setActiveTree(response.data);
    }
  };

  const handleOpenEdit = (node: TaxonomyNode) => {
    setEditNode(node);
    setEditLabel(node.label);
  };

  const handleRename = async () => {
    if (!editNode || !selectedScope || !editLabel.trim()) return;

    setIsSavingNode(true);
    setError(null);
    try {
      const response = await renameTaxonomyNodeAction({
        workspaceId,
        tenantId: selectedScope.tenant_id,
        nodeId: editNode.id,
        label: editLabel.trim(),
      });
      if (!response?.data) {
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_rename_failed"));
        return;
      }

      if (selectedNode?.id === response.data.id) {
        setSelectedNode(response.data);
      }
      setEditNode(null);
      await reloadTree();
    } catch {
      setError(t("workspace.unify.taxonomy_rename_failed"));
    } finally {
      setIsSavingNode(false);
    }
  };

  const handleRemove = async () => {
    if (!editNode || !selectedScope) return;

    setIsSavingNode(true);
    setError(null);
    try {
      const response = await removeTaxonomyNodeAction({
        workspaceId,
        tenantId: selectedScope.tenant_id,
        nodeId: editNode.id,
      });
      if (!response?.data) {
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_remove_failed"));
        return;
      }

      if (selectedNode?.id === editNode.id) {
        setSelectedNode(null);
        setNodeRecords([]);
      }
      setEditNode(null);
      await reloadTree();
    } catch {
      setError(t("workspace.unify.taxonomy_remove_failed"));
    } finally {
      setIsSavingNode(false);
    }
  };

  const hasDirectories = directoryIds.length > 0;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.unify.feedback_records")}>
        <UnifyConfigNavigation workspaceId={workspaceId} activeId="topics-subtopics" />
      </PageHeader>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <Selector label={t("workspace.unify.feedback_directory")}>
              <Select
                value={directoryId}
                onValueChange={setDirectoryId}
                disabled={!hasDirectories || isLoadingFields}>
                <SelectTrigger>
                  <SelectValue placeholder={t("workspace.unify.select_feedback_directory")} />
                </SelectTrigger>
                <SelectContent>
                  {directoryIds.map((id) => (
                    <SelectItem key={id} value={id}>
                      {directoryMap[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Selector>

            <Selector label={t("workspace.unify.taxonomy_source")}>
              <Select
                value={selectedSourceKey}
                onValueChange={handleSourceChange}
                disabled={sourceOptions.length === 0 || isLoadingFields}>
                <SelectTrigger>
                  <SelectValue placeholder={t("workspace.unify.taxonomy_select_source")} />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((field) => (
                    <SelectItem key={sourceKey(field)} value={sourceKey(field)}>
                      {field.source_name || field.source_id} ({field.source_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Selector>

            <Selector label={t("workspace.unify.taxonomy_field")}>
              <Select
                value={selectedFieldKey}
                onValueChange={setSelectedFieldKey}
                disabled={filteredFields.length === 0 || isLoadingFields}>
                <SelectTrigger>
                  <SelectValue placeholder={t("workspace.unify.taxonomy_select_field")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredFields.map((field) => (
                    <SelectItem key={fieldKey(field)} value={fieldKey(field)}>
                      {field.field_label || field.field_id} ({field.embedding_count}/{field.record_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Selector>

            <Button
              type="button"
              className="h-9 shrink-0"
              disabled={!canGenerate}
              loading={isGenerating}
              onClick={handleGenerate}>
              {activeTree ? <RefreshCwIcon className="size-4" /> : <PlayIcon className="size-4" />}
              {activeTree ? t("workspace.unify.taxonomy_regenerate") : t("workspace.unify.taxonomy_generate")}
            </Button>
          </div>

          {selectedField && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <Badge
                text={t("workspace.unify.taxonomy_embedded_records_short", {
                  count: selectedField.embedding_count,
                })}
                type="gray"
                size="tiny"
              />
              <Badge
                text={t("workspace.unify.taxonomy_text_records_short", {
                  count: selectedField.record_count,
                })}
                type="gray"
                size="tiny"
              />
              {!canWrite && (
                <Badge text={t("workspace.unify.taxonomy_read_only")} type="warning" size="tiny" />
              )}
            </div>
          )}
        </div>

        {!hasDirectories && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">{t("workspace.unify.taxonomy_no_directory")}</p>
            <Button className="mt-4" size="sm" asChild>
              <Link href={`/workspaces/${workspaceId}/feedback-sources`}>
                {t("workspace.unify.manage_feedback_sources")}
              </Link>
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
        {notice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {notice}
          </div>
        )}

        {latestRun && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                text={runStatusLabel(latestRun.status, t)}
                type={statusBadgeType(latestRun.status)}
                size="tiny"
              />
              <span className="text-sm text-slate-600">
                {t("workspace.unify.taxonomy_run_summary", {
                  embeddedCount: latestRun.embedding_count,
                  clusterCount: latestRun.cluster_count,
                  topicCount: latestRun.node_count,
                })}
              </span>
              {hasRunningRun && <Loader2Icon className="size-4 animate-spin text-slate-500" />}
            </div>
            {latestRunError && <p className="mt-2 text-sm text-red-700">{latestRunError}</p>}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("workspace.unify.taxonomy_title")}
                </h2>
              </div>
              {isLoadingState && <Loader2Icon className="size-4 animate-spin text-slate-500" />}
            </div>

            <div className="p-4">
              {activeTree?.root ? (
                <div className="overflow-x-auto">
                  <div
                    className="grid min-h-[560px] gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(taxonomyColumns.length, 1)}, minmax(220px, 1fr))`,
                      minWidth: `${Math.max(taxonomyColumns.length, 3) * 244}px`,
                    }}>
                    {taxonomyColumns.map((column) => (
                      <TaxonomyColumnView
                        key={column.level}
                        column={column}
                        selectedPathIds={selectedPathIds}
                        selectedNodeId={selectedNode?.id}
                        selectedNodeRecordCount={selectedNodeRecordCount}
                        canWrite={canWrite}
                        onSelect={handleSelectNode}
                        onEdit={handleOpenEdit}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
                  {selectedField
                    ? t("workspace.unify.taxonomy_empty_no_active")
                    : t("workspace.unify.taxonomy_empty_select_field")}
                </div>
              )}
            </div>
          </div>

          <TaxonomyDetailPanel
            selectedNode={selectedNode}
            nodeRecords={nodeRecords}
            selectedNodeRecordCount={selectedNodeRecordCount}
            isLoadingRecords={isLoadingRecords}
            canWrite={canWrite}
            onEdit={handleOpenEdit}
            onOpenRecords={() => setIsRecordsDrawerOpen(true)}
          />
        </div>
      </div>

      <EditKeywordDialog
        node={editNode}
        label={editLabel}
        canWrite={canWrite}
        isSaving={isSavingNode}
        onOpenChange={(open) => {
          if (!open) setEditNode(null);
        }}
        onLabelChange={setEditLabel}
        onSave={handleRename}
        onRemove={handleRemove}
      />

      <RecordsSheet
        open={isRecordsDrawerOpen}
        onOpenChange={setIsRecordsDrawerOpen}
        selectedNode={selectedNode}
        nodeRecords={nodeRecords}
        selectedNodeRecordCount={selectedNodeRecordCount}
        isLoadingRecords={isLoadingRecords}
      />
    </PageContentWrapper>
  );
};

const Selector = ({ label, children }: Readonly<{ label: string; children: ReactNode }>) => (
  <label className="min-w-0 flex-1 space-y-1">
    <span className="block text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

const TaxonomyColumnView = ({
  column,
  selectedPathIds,
  selectedNodeId,
  selectedNodeRecordCount,
  canWrite,
  onSelect,
  onEdit,
}: Readonly<{
  column: TaxonomyColumn;
  selectedPathIds: Set<string>;
  selectedNodeId?: string;
  selectedNodeRecordCount: number | null;
  canWrite: boolean;
  onSelect: (node: TaxonomyNode) => void;
  onEdit: (node: TaxonomyNode) => void;
}>) => (
  <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
    <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">
          Level {column.level} keywords
        </h3>
        <span className="text-xs font-medium text-slate-400">{column.nodes.length}</span>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled
        title="Adding taxonomy keywords is not part of the beta edit scope.">
        <PlusIcon className="size-3.5" />
        Add
      </button>
    </div>

    <div className="space-y-1 p-2">
      {column.nodes.map((node) => (
        <TaxonomyColumnRow
          key={node.id}
          node={node}
          isInSelectedPath={selectedPathIds.has(node.id)}
          isSelected={selectedNodeId === node.id}
          selectedNodeRecordCount={selectedNodeRecordCount}
          canWrite={canWrite}
          onSelect={onSelect}
          onEdit={onEdit}
        />
      ))}
    </div>
  </section>
);

const TaxonomyColumnRow = ({
  node,
  isInSelectedPath,
  isSelected,
  selectedNodeRecordCount,
  canWrite,
  onSelect,
  onEdit,
}: Readonly<{
  node: TaxonomyNode;
  isInSelectedPath: boolean;
  isSelected: boolean;
  selectedNodeRecordCount: number | null;
  canWrite: boolean;
  onSelect: (node: TaxonomyNode) => void;
  onEdit: (node: TaxonomyNode) => void;
}>) => {
  const count = isSelected ? selectedNodeRecordCount : getNodeRecordEstimate(node);
  const hasChildren = Boolean(node.children?.length);

  return (
    <div
      className={`group flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
        isInSelectedPath ? "bg-slate-950 text-white" : "text-slate-800 hover:bg-slate-50 hover:text-slate-950"
      }`}>
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left font-medium"
        onClick={() => onSelect(node)}>
        {node.label}
      </button>
      {count !== null && (
        <span className={isInSelectedPath ? "text-xs text-slate-300" : "text-xs text-slate-400"}>
          {count.toLocaleString()}
        </span>
      )}
      {canWrite && (
        <button
          type="button"
          aria-label={`Edit ${node.label}`}
          className={`rounded p-0.5 ${
            isInSelectedPath
              ? "text-slate-300 hover:text-white"
              : "text-slate-400 opacity-0 hover:text-slate-700 group-hover:opacity-100"
          }`}
          onClick={() => onEdit(node)}>
          <PencilIcon className="size-3.5" />
        </button>
      )}
      {hasChildren && (
        <ChevronRightIcon className={isInSelectedPath ? "size-4 text-slate-300" : "size-4 text-slate-400"} />
      )}
    </div>
  );
};

const TaxonomyDetailPanel = ({
  selectedNode,
  nodeRecords,
  selectedNodeRecordCount,
  isLoadingRecords,
  canWrite,
  onEdit,
  onOpenRecords,
}: Readonly<{
  selectedNode: TaxonomyNode | null;
  nodeRecords: TaxonomyNodeRecordsResponse["data"];
  selectedNodeRecordCount: number | null;
  isLoadingRecords: boolean;
  canWrite: boolean;
  onEdit: (node: TaxonomyNode) => void;
  onOpenRecords: () => void;
}>) => {
  const { t } = useTranslation();
  const childKeywords = selectedNode?.children ?? [];

  return (
    <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {selectedNode ? (
        <div className="space-y-6 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-slate-950">{selectedNode.label}</h2>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-dark hover:text-brand-dark/80"
                onClick={onOpenRecords}>
                {isLoadingRecords ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <FileTextIcon className="size-4" />
                )}
                {selectedNodeRecordCount === null
                  ? "View records"
                  : `View ${selectedNodeRecordCount.toLocaleString()} records`}
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
            {canWrite && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(selectedNode)}>
                <PencilIcon className="size-4" />
                {t("common.edit")}
              </Button>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            {selectedNode.description || "Feedback records classified under this keyword."}
          </div>

          {childKeywords.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-950">{childKeywords.length} child keywords</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-500"
                  disabled
                  title="Adding taxonomy keywords is not part of the beta edit scope.">
                  <PlusIcon className="size-4" />
                  Add keyword
                </button>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                {childKeywords.map((child, index) => (
                  <div
                    key={child.id}
                    className={
                      ["bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-sky-400", "bg-violet-400"][
                        index % 5
                      ]
                    }
                    style={{ width: `${100 / childKeywords.length}%` }}
                  />
                ))}
              </div>
              <div className="space-y-3">
                {childKeywords.map((child, index) => (
                  <div key={child.id} className="rounded-lg border border-slate-100 p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 size-2 rounded-full ${
                          ["bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-sky-400", "bg-violet-400"][
                            index % 5
                          ]
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          {nodeTypeLabel(child.node_type, t)}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-950">{child.label}</p>
                        {child.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{child.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-950">
                  {t("workspace.unify.feedback_records")}
                </p>
                {isLoadingRecords && <Loader2Icon className="size-4 animate-spin text-slate-500" />}
              </div>
              {nodeRecords.length > 0 ? (
                <div className="space-y-3">
                  {nodeRecords.slice(0, 3).map((record) => (
                    <FeedbackRecordCard key={record.id} record={record} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("workspace.unify.taxonomy_no_records")}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("workspace.unify.taxonomy_selected_topic")}
          </h2>
          <p className="mt-4 text-sm text-slate-500">{t("workspace.unify.taxonomy_select_topic")}</p>
        </div>
      )}
    </aside>
  );
};

const EditKeywordDialog = ({
  node,
  label,
  canWrite,
  isSaving,
  onOpenChange,
  onLabelChange,
  onSave,
  onRemove,
}: Readonly<{
  node: TaxonomyNode | null;
  label: string;
  canWrite: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onLabelChange: (label: string) => void;
  onSave: () => void;
  onRemove: () => void;
}>) => {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent width="narrow" className="p-6">
        <DialogHeader>
          <DialogTitle>Edit Level {node?.level ?? ""} keyword</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5 overflow-visible">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-900">Keyword</span>
            <Input
              value={label}
              disabled={!canWrite || isSaving}
              onChange={(event) => onLabelChange(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-900">{t("common.description")}</span>
            <textarea
              className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              value={node?.description ?? ""}
              readOnly
              placeholder="Generated description"
            />
            <p className="text-xs text-slate-500">Beta edits currently support keyword rename and removal.</p>
          </label>
        </DialogBody>
        <DialogFooter className="items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            disabled={!canWrite || isSaving || !node || node.node_type === "root"}
            onClick={onRemove}>
            <Trash2Icon className="size-4" />
            {t("common.delete")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={isSaving} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!canWrite || isSaving || !label.trim()}
              loading={isSaving}
              onClick={onSave}>
              {t("common.save_changes")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RecordsSheet = ({
  open,
  onOpenChange,
  selectedNode,
  nodeRecords,
  selectedNodeRecordCount,
  isLoadingRecords,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: TaxonomyNode | null;
  nodeRecords: TaxonomyNodeRecordsResponse["data"];
  selectedNodeRecordCount: number | null;
  isLoadingRecords: boolean;
}>) => {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-white sm:max-w-[640px]">
        <SheetHeader className="space-y-1 pr-8">
          <SheetTitle>{selectedNode?.label ?? t("workspace.unify.feedback_records")}</SheetTitle>
          <SheetDescription>
            {selectedNodeRecordCount === null
              ? `Showing the first ${nodeRecords.length.toLocaleString()} feedback records classified under this keyword.`
              : `Showing ${nodeRecords.length.toLocaleString()} of ${selectedNodeRecordCount.toLocaleString()} feedback records classified under this keyword.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {isLoadingRecords && <Loader2Icon className="size-4 animate-spin text-slate-500" />}
          {nodeRecords.length > 0 ? (
            nodeRecords.map((record) => <FeedbackRecordCard key={record.id} record={record} />)
          ) : (
            <p className="text-sm text-slate-500">{t("workspace.unify.taxonomy_no_records")}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const FeedbackRecordCard = ({
  record,
}: Readonly<{ record: TaxonomyNodeRecordsResponse["data"][number] }>) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <Badge text={record.source_type || "feedback"} type="gray" size="tiny" />
        {record.field_type && <Badge text={record.field_type} type="gray" size="tiny" />}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {record.field_label || record.field_id}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {record.value_text || t("workspace.unify.taxonomy_no_text_value")}
      </p>
    </div>
  );
};
