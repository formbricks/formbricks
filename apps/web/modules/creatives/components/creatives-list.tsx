"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  CopyPlusIcon,
  LinkIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SearchXIcon,
  SquareChartGanttIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import type { TCreativeDisplayState } from "../lib/display-status";
import { getCreativeEditPath, getCreativeSummaryPath } from "../lib/paths";
import { getMockDisplayState, getMockLinkedSurvey } from "../mock/data";
import type { TCreative } from "../types";
import { CreativeTypeIcon } from "./creative-icons";
import { CreativeStatusBadge } from "./creative-status-badge";

type TQuickTab = "active" | "scheduled" | "all";

interface TCreativeRow {
  creative: TCreative;
  state: TCreativeDisplayState;
}

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-x-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_2.5rem]";

const getLinkPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const OpensCell = ({ creative }: Readonly<{ creative: TCreative }>) => {
  const { t } = useTranslation();
  if (creative.action.kind === "link") {
    if (!creative.action.url) return <span className="text-slate-400">—</span>;
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <LinkIcon className="size-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{`${t("common.link")} · ${getLinkPath(creative.action.url)}`}</span>
      </span>
    );
  }
  const survey = getMockLinkedSurvey(creative);
  if (!survey) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <MessageCircleIcon className="size-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{survey.name}</span>
    </span>
  );
};

export const CreativesList = ({
  workspaceId,
  initialCreatives,
}: Readonly<{ workspaceId: string; initialCreatives: TCreative[] }>) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [now] = useState(() => new Date());
  const [creatives, setCreatives] = useState(initialCreatives);
  const [quickTab, setQuickTab] = useState<TQuickTab>("all");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TCreative | null>(null);

  const rows: TCreativeRow[] = creatives.map((creative) => ({
    creative,
    state: getMockDisplayState(creative, now),
  }));
  const counts: Record<TQuickTab, number> = {
    active: rows.filter((row) => row.state.status === "active").length,
    scheduled: rows.filter((row) => row.state.status === "scheduled").length,
    all: rows.length,
  };
  const query = search.trim().toLowerCase();
  const visibleRows = rows.filter(
    (row) =>
      (quickTab === "all" || row.state.status === quickTab) &&
      (!query || row.creative.name.toLowerCase().includes(query))
  );

  const typeLabels = {
    feedback_button: t("workspace.creatives.type_feedback_button"),
    banner: t("workspace.creatives.type_banner"),
  };

  const getRowHref = ({ creative }: TCreativeRow) =>
    creative.status === "draft"
      ? getCreativeEditPath(workspaceId, creative.id)
      : getCreativeSummaryPath(workspaceId, creative.id);

  const duplicate = (creative: TCreative) => {
    const copy: TCreative = {
      ...creative,
      id: `${creative.id}_copy_${Date.now()}`,
      name: t("workspace.creatives.copy_of", { name: creative.name }),
      status: "draft",
      archivedAt: null,
      publishedAt: null,
      updatedAt: new Date(),
      daily: [],
      pages: [],
    };
    setCreatives((current) => [copy, ...current]);
    toast.success(t("workspace.creatives.toast_duplicated"));
  };

  const patch = (creativeId: string, change: Partial<TCreative>) =>
    setCreatives((current) =>
      current.map((item) => (item.id === creativeId ? { ...item, ...change } : item))
    );

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={quickTab} onValueChange={(value) => setQuickTab(value as TQuickTab)}>
          <TabsList>
            {(["active", "scheduled", "all"] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="gap-2">
                {tab === "active" && t("workspace.creatives.quick_tab_active")}
                {tab === "scheduled" && t("common.scheduled")}
                {tab === "all" && t("common.all")}
                <span className="rounded-full bg-slate-200/70 px-1.5 text-xs text-slate-600 tabular-nums">
                  {counts[tab]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("workspace.creatives.search_placeholder")}
          className="sm:w-72"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div
          className={`${ROW_GRID} border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500`}>
          <span>{t("common.name")}</span>
          <span>{t("common.status")}</span>
          <span className="hidden md:block">{t("common.type")}</span>
          <span className="hidden md:block">{t("workspace.creatives.column_opens")}</span>
          <span className="hidden md:block">{t("common.updated")}</span>
          <span className="sr-only">{t("common.actions")}</span>
        </div>

        {visibleRows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-sm text-slate-500">
            <SearchXIcon className="size-6 text-slate-400" strokeWidth={1.5} />
            {t("workspace.creatives.no_matches")}
          </div>
        )}

        <ul>
          {visibleRows.map((row) => {
            const { creative, state } = row;
            const canTogglePause =
              !creative.archivedAt && (creative.status === "inProgress" || creative.status === "paused");
            return (
              <li
                key={creative.id}
                className={`${ROW_GRID} group relative border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50`}>
                <Link
                  href={getRowHref(row)}
                  className="flex min-w-0 items-center gap-3 font-medium text-slate-900 after:absolute after:inset-0 focus-visible:outline-hidden">
                  <CreativeTypeIcon type={creative.type} />
                  <span className="truncate">
                    {creative.name || t("workspace.creatives.untitled_creative")}
                  </span>
                </Link>
                <span className="relative">
                  <CreativeStatusBadge state={state} />
                </span>
                <span className="hidden truncate text-slate-600 md:block">{typeLabels[creative.type]}</span>
                <span className="hidden min-w-0 text-slate-600 md:block">
                  <OpensCell creative={creative} />
                </span>
                <span className="hidden text-slate-500 tabular-nums md:block">
                  {formatDateForDisplay(creative.updatedAt, locale)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative z-10 size-8 text-slate-500"
                      aria-label={t("common.actions")}>
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      icon={<PencilIcon className="size-4" />}
                      onClick={() => router.push(getCreativeEditPath(workspaceId, creative.id))}>
                      {t("common.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<SquareChartGanttIcon className="size-4" />}
                      disabled={creative.status === "draft"}
                      onClick={() => router.push(getCreativeSummaryPath(workspaceId, creative.id))}>
                      {t("workspace.creatives.view_summary")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<CopyPlusIcon className="size-4" />}
                      onClick={() => duplicate(creative)}>
                      {t("common.duplicate")}
                    </DropdownMenuItem>
                    {canTogglePause && (
                      <DropdownMenuItem
                        icon={
                          creative.status === "paused" ? (
                            <PlayIcon className="size-4" />
                          ) : (
                            <PauseIcon className="size-4" />
                          )
                        }
                        onClick={() => toggleOwnPause(creative)}>
                        {creative.status === "paused"
                          ? t("workspace.creatives.resume")
                          : t("workspace.creatives.pause")}
                      </DropdownMenuItem>
                    )}
                    {creative.status !== "draft" && (
                      <DropdownMenuItem
                        icon={
                          creative.archivedAt ? (
                            <ArchiveRestoreIcon className="size-4" />
                          ) : (
                            <ArchiveIcon className="size-4" />
                          )
                        }
                        onClick={() => toggleArchived(creative)}>
                        {creative.archivedAt ? t("workspace.creatives.restore") : t("common.archive")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem icon={<CopyIcon className="size-4" />} onClick={() => copyId(creative)}>
                      {t("workspace.creatives.copy_id")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      icon={<TrashIcon className="size-4" />}
                      className="text-red-600 focus:text-red-700"
                      onClick={() => setPendingDelete(creative)}>
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      </div>

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
