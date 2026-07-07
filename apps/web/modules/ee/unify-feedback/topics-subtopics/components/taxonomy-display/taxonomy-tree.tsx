"use client";

import { CheckIcon, ChevronRightIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TaxonomyNode } from "@/modules/hub/types";
import { Input } from "@/modules/ui/components/input";

interface TaxonomyTreeProps {
  root: TaxonomyNode;
  selectedNodeId: string | null;
  editMode: boolean;
  onSelect: (node: TaxonomyNode) => void;
  /** Resolves on success (editor closes) and rejects on failure (editor stays open; caller toasts). */
  onRename: (nodeId: string, label: string) => Promise<void>;
  onRequestRemove: (node: TaxonomyNode) => void;
}

/** Nested, collapsible taxonomy tree. Children render lazily on expand. In edit mode, each row exposes
 * inline rename + remove; "add" is intentionally absent (the Hub cannot create nodes yet). */
export const TaxonomyTree = ({
  root,
  selectedNodeId,
  editMode,
  onSelect,
  onRename,
  onRequestRemove,
}: Readonly<TaxonomyTreeProps>) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <div className="space-y-0.5">
      {(root.children ?? []).map((node) => (
        <TaxonomyTreeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          selectedNodeId={selectedNodeId}
          editMode={editMode}
          renamingId={renamingId}
          onToggleExpand={toggleExpand}
          onSelect={onSelect}
          onStartRename={setRenamingId}
          onCloseRename={() => setRenamingId(null)}
          onRename={onRename}
          onRequestRemove={onRequestRemove}
        />
      ))}
    </div>
  );
};

interface TaxonomyTreeRowProps {
  node: TaxonomyNode;
  depth: number;
  expandedIds: Set<string>;
  selectedNodeId: string | null;
  editMode: boolean;
  renamingId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (node: TaxonomyNode) => void;
  onStartRename: (id: string) => void;
  onCloseRename: () => void;
  onRename: (nodeId: string, label: string) => Promise<void>;
  onRequestRemove: (node: TaxonomyNode) => void;
}

const TaxonomyTreeRow = ({
  node,
  depth,
  expandedIds,
  selectedNodeId,
  editMode,
  renamingId,
  onToggleExpand,
  onSelect,
  onStartRename,
  onCloseRename,
  onRename,
  onRequestRemove,
}: Readonly<TaxonomyTreeRowProps>) => {
  const { t } = useTranslation();
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isRenaming = renamingId === node.id;

  return (
    <>
      <div
        className={cn(
          "group flex min-h-9 items-center gap-1 rounded-md pr-2 text-sm transition-colors",
          isSelected ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-50"
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        <button
          type="button"
          aria-label={
            hasChildren
              ? isExpanded
                ? t("workspace.unify.taxonomy_collapse")
                : t("workspace.unify.taxonomy_expand")
              : undefined
          }
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded",
            !hasChildren && "invisible"
          )}
          disabled={!hasChildren}
          onClick={() => hasChildren && onToggleExpand(node.id)}>
          <ChevronRightIcon className={cn("size-4 transition-transform", isExpanded && "rotate-90")} />
        </button>

        {isRenaming ? (
          <InlineRename node={node} onClose={onCloseRename} onRename={onRename} />
        ) : (
          <>
            <button
              type="button"
              className="min-w-0 flex-1 truncate py-2 text-left font-medium"
              onClick={() => onSelect(node)}>
              {node.label}
            </button>
            {editMode && (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-0.5",
                  !isSelected && "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                )}>
                <button
                  type="button"
                  aria-label={t("workspace.unify.taxonomy_edit_keyword_aria", { keyword: node.label })}
                  className={cn(
                    "rounded p-1",
                    isSelected ? "text-slate-300 hover:text-white" : "text-slate-400 hover:text-slate-700"
                  )}
                  onClick={() => onStartRename(node.id)}>
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t("workspace.unify.taxonomy_remove_keyword_aria", { keyword: node.label })}
                  className={cn(
                    "rounded p-1",
                    isSelected ? "text-slate-300 hover:text-white" : "text-slate-400 hover:text-red-600"
                  )}
                  onClick={() => onRequestRemove(node)}>
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {(node.children ?? []).map((child) => (
            <TaxonomyTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              editMode={editMode}
              renamingId={renamingId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onCloseRename={onCloseRename}
              onRename={onRename}
              onRequestRemove={onRequestRemove}
            />
          ))}
        </div>
      )}
    </>
  );
};

const InlineRename = ({
  node,
  onClose,
  onRename,
}: Readonly<{
  node: TaxonomyNode;
  onClose: () => void;
  onRename: (nodeId: string, label: string) => Promise<void>;
}>) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(node.label);
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = value.trim();

  const save = async () => {
    if (!trimmed || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onRename(node.id, trimmed);
      onClose();
    } catch {
      // Caller toasts the failure; keep the editor open so the user can retry or cancel.
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="flex flex-1 items-center gap-1 py-1">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the field the user just opened */}
      <Input
        autoFocus
        value={value}
        maxLength={1000}
        disabled={isSaving}
        aria-label={t("workspace.unify.taxonomy_keyword")}
        className="h-7"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        aria-label={t("common.save_changes")}
        className="rounded p-1 text-slate-500 hover:text-slate-900 disabled:opacity-50"
        disabled={!trimmed || isSaving}
        onClick={() => void save()}>
        <CheckIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t("common.cancel")}
        className="rounded p-1 text-slate-500 hover:text-slate-900"
        disabled={isSaving}
        onClick={onClose}>
        <XIcon className="size-4" />
      </button>
    </div>
  );
};
