"use client";

import { GitBranchIcon, Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FeedbackRecordData, TaxonomyNode, TaxonomyTreeResponse } from "@/modules/hub/types";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { TaxonomyNodeRecords } from "./taxonomy-node-records";
import { TaxonomyTree } from "./taxonomy-tree";

interface TaxonomyDisplayProps {
  activeTree: TaxonomyTreeResponse | null;
  hasScope: boolean;
  isLoadingTree: boolean;
  isFetchingTree: boolean;
  isTreeError: boolean;
  onRetryTree: () => void;
  selectedNode: TaxonomyNode | null;
  selectedNodeId: string | null;
  editMode: boolean;
  onSelectNode: (node: TaxonomyNode) => void;
  onRenameNode: (nodeId: string, label: string) => Promise<void>;
  onRequestRemoveNode: (node: TaxonomyNode) => void;
  records: FeedbackRecordData[];
  recordsLimit: number;
  isLoadingRecords: boolean;
  isFetchingRecords: boolean;
  isRecordsError: boolean;
  onRetryRecords: () => void;
}

const TreeSkeleton = () => (
  <div className="space-y-2 p-2">
    {[0, 1, 2, 3, 4].map((row) => (
      <div key={row} className="h-8 animate-pulse rounded-md bg-slate-100" />
    ))}
  </div>
);

export const TaxonomyDisplay = ({
  activeTree,
  hasScope,
  isLoadingTree,
  isFetchingTree,
  isTreeError,
  onRetryTree,
  selectedNode,
  selectedNodeId,
  editMode,
  onSelectNode,
  onRenameNode,
  onRequestRemoveNode,
  records,
  recordsLimit,
  isLoadingRecords,
  isFetchingRecords,
  isRecordsError,
  onRetryRecords,
}: Readonly<TaxonomyDisplayProps>) => {
  const { t } = useTranslation();
  const hasTree = Boolean(activeTree?.root?.children?.length);

  const renderTree = () => {
    if (isLoadingTree) {
      return <TreeSkeleton />;
    }
    if (!hasScope) {
      return <EmptyState text={t("workspace.unify.taxonomy_empty_select_field")} variant="simple" />;
    }
    if (isTreeError) {
      return (
        <div className="p-3">
          <Alert variant="error" size="small">
            <AlertTitle>{t("common.something_went_wrong_please_try_again")}</AlertTitle>
            <AlertDescription>{t("workspace.unify.taxonomy_load_failed")}</AlertDescription>
            <AlertButton onClick={onRetryTree}>{t("common.retry")}</AlertButton>
          </Alert>
        </div>
      );
    }
    if (activeTree?.root && hasTree) {
      return (
        <div className="p-2">
          <TaxonomyTree
            root={activeTree.root}
            selectedNodeId={selectedNodeId}
            editMode={editMode}
            onSelect={onSelectNode}
            onRename={onRenameNode}
            onRequestRemove={onRequestRemoveNode}
          />
        </div>
      );
    }
    return (
      <div className="p-3">
        <EmptyState text={t("workspace.unify.taxonomy_empty_no_active")} variant="simple" />
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <GitBranchIcon className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">{t("workspace.unify.taxonomy_title")}</h2>
          </div>
          {isFetchingTree && !isLoadingTree && <Loader2Icon className="size-4 animate-spin text-slate-400" />}
        </div>
        {renderTree()}
      </div>

      <TaxonomyNodeRecords
        node={selectedNode}
        records={records}
        limit={recordsLimit}
        isLoading={isLoadingRecords}
        isFetching={isFetchingRecords}
        isError={isRecordsError}
        onRetry={onRetryRecords}
      />
    </div>
  );
};
