"use client";

import type { TFunction } from "i18next";
import { GitBranchIcon, Loader2Icon, PencilIcon, PlayIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
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
  const [renameLabel, setRenameLabel] = useState("");
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

  const handleSelectNode = async (node: TaxonomyNode) => {
    if (!selectedScope) return;

    setSelectedNode(node);
    setRenameLabel(node.label);
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
  };

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

  const handleRename = async () => {
    if (!selectedNode || !selectedScope || !renameLabel.trim()) return;

    setIsSavingNode(true);
    setError(null);
    try {
      const response = await renameTaxonomyNodeAction({
        workspaceId,
        tenantId: selectedScope.tenant_id,
        nodeId: selectedNode.id,
        label: renameLabel.trim(),
      });
      if (!response?.data) {
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_rename_failed"));
        return;
      }

      setSelectedNode(response.data);
      await reloadTree();
    } catch {
      setError(t("workspace.unify.taxonomy_rename_failed"));
    } finally {
      setIsSavingNode(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedNode || !selectedScope) return;

    setIsSavingNode(true);
    setError(null);
    try {
      const response = await removeTaxonomyNodeAction({
        workspaceId,
        tenantId: selectedScope.tenant_id,
        nodeId: selectedNode.id,
      });
      if (!response?.data) {
        setError(getFormattedErrorMessage(response) ?? t("workspace.unify.taxonomy_remove_failed"));
        return;
      }

      setSelectedNode(null);
      setNodeRecords([]);
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
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
                <TaxonomyTree
                  node={activeTree.root}
                  selectedNodeId={selectedNode?.id}
                  onSelect={handleSelectNode}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
                  {selectedField
                    ? t("workspace.unify.taxonomy_empty_no_active")
                    : t("workspace.unify.taxonomy_empty_select_field")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("workspace.unify.taxonomy_selected_topic")}
              </h2>
            </div>

            <div className="space-y-4 p-4">
              {selectedNode ? (
                <>
                  <div className="space-y-2">
                    <Input value={renameLabel} onChange={(event) => setRenameLabel(event.target.value)} />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canWrite || isSavingNode || !renameLabel.trim()}
                        loading={isSavingNode}
                        onClick={handleRename}>
                        <PencilIcon className="size-4" />
                        {t("workspace.unify.taxonomy_rename")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!canWrite || isSavingNode || selectedNode.node_type === "root"}
                        onClick={handleRemove}>
                        <Trash2Icon className="size-4" />
                        {t("workspace.unify.taxonomy_remove")}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {t("workspace.unify.feedback_records")}
                      </p>
                      {isLoadingRecords && <Loader2Icon className="size-4 animate-spin text-slate-500" />}
                    </div>
                    {nodeRecords.length > 0 ? (
                      <div className="max-h-[520px] space-y-3 overflow-auto">
                        {nodeRecords.map((record) => (
                          <div key={record.id} className="rounded-lg border border-slate-200 p-3">
                            <p className="truncate text-xs font-medium text-slate-500">
                              {record.field_label || record.field_id}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                              {record.value_text || t("workspace.unify.taxonomy_no_text_value")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">{t("workspace.unify.taxonomy_no_records")}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">{t("workspace.unify.taxonomy_select_topic")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContentWrapper>
  );
};

const Selector = ({ label, children }: Readonly<{ label: string; children: ReactNode }>) => (
  <label className="min-w-0 flex-1 space-y-1">
    <span className="block text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

const TaxonomyTree = ({
  node,
  selectedNodeId,
  onSelect,
}: Readonly<{
  node: TaxonomyNode;
  selectedNodeId?: string;
  onSelect: (node: TaxonomyNode) => void;
}>) => {
  const { t } = useTranslation();
  const isSelected = selectedNodeId === node.id;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={`flex min-h-9 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
          isSelected ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
        }`}
        style={{
          marginLeft: `${Math.min(node.level, 5) * 16}px`,
          width: `calc(100% - ${Math.min(node.level, 5) * 16}px)`,
        }}
        onClick={() => onSelect(node)}>
        <span className="min-w-0 truncate">{node.label}</span>
        <Badge text={nodeTypeLabel(node.node_type, t)} type="gray" size="tiny" />
      </button>
      {node.children?.map((child) => (
        <TaxonomyTree key={child.id} node={child} selectedNodeId={selectedNodeId} onSelect={onSelect} />
      ))}
    </div>
  );
};
