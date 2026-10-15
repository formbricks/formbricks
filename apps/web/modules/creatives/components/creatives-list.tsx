"use client";

import { LinkIcon, MessageCircleIcon, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { timeSinceDate } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { CardTableHeader, CardTableRow } from "@/modules/ui/components/card-table";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { FilterDropdown, type TFilterOption } from "@/modules/ui/components/filter-dropdown";
import { SearchBar } from "@/modules/ui/components/search-bar";
import type { TCreativeDisplayStatus } from "../lib/display-status";
import {
  INITIAL_CREATIVE_FILTERS,
  type TCreativeListFilters,
  type TCreativeListRow,
  filterCreativeRows,
  hasActiveCreativeFilters,
} from "../lib/list-filters";
import { getCreativeEditPath, getCreativeSummaryPath } from "../lib/paths";
import { getMockDisplayState, getMockLinkedSurvey } from "../mock/data";
import type { TCreative, TCreativeType } from "../types";
import { CreativeTypeIndicator } from "./creative-icons";
import { CreativeListActions } from "./creative-list-actions";
import { CreativeStatusPill } from "./creative-status-pill";
import { CreativesSortDropdown } from "./creatives-sort-dropdown";

// Same layout as the surveys list: toolbar, then a card table with the columns of the surveys
// list, where Responses becomes what the creative opens (counts live on the summary page only).
const GRID = "grid-cols-8";

const getLinkPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const OpensCell = ({ creative }: Readonly<{ creative: TCreative }>) => {
  const { t } = useTranslation();
  const survey = getMockLinkedSurvey(creative);
  const target =
    creative.action.kind === "link" && creative.action.url
      ? { icon: LinkIcon, text: `${t("common.link")} · ${getLinkPath(creative.action.url)}` }
      : survey && { icon: MessageCircleIcon, text: survey.name };
  if (!target) return <span>-</span>;
  const Icon = target.icon;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{target.text}</span>
    </span>
  );
};

export const CreativesList = ({
  workspaceId,
  initialCreatives,
}: Readonly<{ workspaceId: string; initialCreatives: TCreative[] }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [now] = useState(() => new Date());
  const [creatives, setCreatives] = useState(initialCreatives);
  const [filters, setFilters] = useState<TCreativeListFilters>(INITIAL_CREATIVE_FILTERS);
  const [openFilter, setOpenFilter] = useState<"status" | "type" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TCreative | null>(null);

  const rows = filterCreativeRows(
    creatives.map((creative) => ({ creative, state: getMockDisplayState(creative, now) })),
    filters
  );

  const statusOptions: TFilterOption<TCreativeDisplayStatus>[] = [
    { label: t("common.draft"), value: "draft" },
    { label: t("common.scheduled"), value: "scheduled" },
    { label: t("common.active"), value: "active" },
    { label: t("common.paused"), value: "paused" },
    { label: t("common.closed"), value: "closed" },
    { label: t("common.archived"), value: "archived", separatorBefore: true },
  ];
  const typeOptions: TFilterOption<TCreativeType>[] = [
    { label: t("workspace.creatives.type_feedback_button"), value: "feedback_button" },
    { label: t("workspace.creatives.type_banner"), value: "banner" },
  ];
  const toggle = <K extends "status" | "type">(key: K, value: TCreativeListFilters[K][number]) =>
    setFilters((current) => {
      const selected = current[key] as string[];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [key]: next };
    });

  const getRowHref = ({ creative }: TCreativeListRow) =>
    creative.status === "draft" && !creative.archivedAt
      ? getCreativeEditPath(workspaceId, creative.id)
      : getCreativeSummaryPath(workspaceId, creative.id);

  const patch = (creativeId: string, change: Partial<TCreative>) =>
    setCreatives((current) =>
      current.map((item) => (item.id === creativeId ? { ...item, ...change } : item))
    );

  const duplicate = (creative: TCreative) => {
    const copy: TCreative = {
      ...creative,
      id: `${creative.id}_copy_${crypto.randomUUID().slice(0, 8)}`,
      name: t("workspace.creatives.copy_of", { name: creative.name }),
      status: "draft",
      archivedAt: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      daily: [],
      pages: [],
    };
    setCreatives((current) => [copy, ...current]);
    toast.success(t("workspace.creatives.toast_duplicated"));
  };

  const toggleArchived = (creative: TCreative) => {
    patch(creative.id, { archivedAt: creative.archivedAt ? null : new Date() });
    toast.success(
      creative.archivedAt
        ? t("workspace.creatives.toast_restored", { name: creative.name })
        : t("workspace.creatives.toast_archived", { name: creative.name })
    );
  };

  const toggleOwnPause = (creative: TCreative) => {
    const nextStatus = creative.status === "paused" ? "inProgress" : "paused";
    patch(creative.id, { status: nextStatus });
    toast.success(
      nextStatus === "paused"
        ? t("workspace.creatives.toast_paused", { name: creative.name })
        : t("workspace.creatives.toast_resumed", { name: creative.name })
    );
  };

  const copyId = async (creative: TCreative) => {
    await navigator.clipboard.writeText(creative.id);
    toast.success(t("common.copied_to_clipboard"));
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setCreatives((current) => current.filter((item) => item.id !== pendingDelete.id));
    toast.success(t("workspace.creatives.toast_deleted"));
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-x-2">
          <SearchBar
            value={filters.name}
            onChange={(name) => setFilters((current) => ({ ...current, name }))}
            placeholder={t("workspace.creatives.search_placeholder")}
            className="w-80 border-slate-700"
          />
          <FilterDropdown
            title={t("common.status")}
            className="creativeFilterDropdown"
            options={statusOptions}
            selectedOptions={filters.status}
            onToggleOption={(value) => toggle("status", value)}
            isOpen={openFilter === "status"}
            onOpenChange={(open) => setOpenFilter(open ? "status" : null)}
          />
          <FilterDropdown
            title={t("common.type")}
            className="creativeFilterDropdown"
            options={typeOptions}
            selectedOptions={filters.type}
            onToggleOption={(value) => toggle("type", value)}
            isOpen={openFilter === "type"}
            onOpenChange={(open) => setOpenFilter(open ? "type" : null)}
          />
          {hasActiveCreativeFilters(filters) && (
            <Button
              size="sm"
              className="h-8"
              onClick={() => setFilters({ ...INITIAL_CREATIVE_FILTERS, sortBy: filters.sortBy })}>
              {t("common.clear_filters")}
              <X />
            </Button>
          )}
        </div>
        <CreativesSortDropdown
          sortBy={filters.sortBy}
          onSortChange={(sortBy) => setFilters((current) => ({ ...current, sortBy }))}
        />
      </div>

      {rows.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center py-16 text-slate-600">
          <span className="size-24 p-4 text-center text-5xl">🕵️</span>
          {t("workspace.creatives.no_matches")}
        </div>
      ) : (
        <div className="space-y-3">
          <CardTableHeader className={GRID}>
            <div className="col-span-2 place-self-start">{t("common.name")}</div>
            <div className="col-span-1">{t("common.status")}</div>
            <div className="col-span-1">{t("common.type")}</div>
            <div className="col-span-1">{t("workspace.creatives.column_opens")}</div>
            <div className="col-span-1">{t("common.created_at")}</div>
            <div className="col-span-1">{t("common.updated_at")}</div>
            <div className="col-span-1">{t("common.created_by")}</div>
          </CardTableHeader>
          {rows.map((row) => {
            const { creative, state } = row;
            return (
              <CardTableRow
                key={creative.id}
                href={getRowHref(row)}
                className={GRID}
                actions={
                  <CreativeListActions
                    workspaceId={workspaceId}
                    creative={creative}
                    onDuplicate={() => duplicate(creative)}
                    onTogglePause={() => toggleOwnPause(creative)}
                    onToggleArchived={() => toggleArchived(creative)}
                    onCopyId={() => void copyId(creative)}
                    onDelete={() => setPendingDelete(creative)}
                  />
                }>
                <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
                  <div className="min-w-0 truncate">
                    {creative.name || t("workspace.creatives.untitled_creative")}
                  </div>
                </div>
                <CreativeStatusPill state={state} />
                <div className="col-span-1">
                  <CreativeTypeIndicator type={creative.type} />
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-slate-600">
                  <OpensCell creative={creative} />
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
                  {formatDateForDisplay(creative.createdAt, locale)}
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
                  {timeSinceDate(creative.updatedAt, locale)}
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
                  {creative.creatorName ?? "-"}
                </div>
              </CardTableRow>
            );
          })}
        </div>
      )}

      <DeleteDialog
        open={!!pendingDelete}
        setOpen={(open) => !open && setPendingDelete(null)}
        deleteWhat={t("workspace.creatives.creative")}
        text={t("workspace.creatives.delete_confirmation", { name: pendingDelete?.name ?? "" })}
        onDelete={confirmDelete}
      />
    </div>
  );
};
