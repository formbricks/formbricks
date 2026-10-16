"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { LinkIcon, MessageCircleIcon, PanelTopIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreativeDisplayStatusZodType, CreativeTypeZodType } from "@formbricks/api-v3-schemas";
import { FORMBRICKS_CREATIVES_FILTERS_KEY_LS } from "@/lib/localStorage";
import { timeSince } from "@/lib/time";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { CardTableHeader, CardTableRow } from "@/modules/ui/components/card-table";
import { FilterDropdown, type TFilterOption } from "@/modules/ui/components/filter-dropdown";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { useActiveCreatives, useCreativesList } from "../hooks/use-creatives-list";
import type { TCreativeListItem } from "../lib/list-api";
import {
  INITIAL_CREATIVE_FILTERS,
  type TCreativeListFilters,
  hasActiveCreativeFilters,
  parseStoredCreativeFilters,
} from "../lib/list-filters";
import { findCreativeOverlaps } from "../lib/overlap";
import { getCreativeEditPath, getCreativeSummaryPath } from "../lib/paths";
import { CreativeTypeIndicator, INDICATOR_TYPES } from "./creative-icons";
import { CreativeListActions } from "./creative-list-actions";
import { CreativeRowWarnings } from "./creative-row-warnings";
import { CreativeStatusPill } from "./creative-status-pill";
import { CreativesListBodySkeleton } from "./creatives-list-skeleton";
import { CreativesSortDropdown } from "./creatives-sort-dropdown";

// Same layout as the surveys list: toolbar, then a card table with the columns of the surveys list,
// where Responses becomes what the creative opens (counts live on the summary page only).
const GRID = "grid-cols-8";
const CREATIVES_PER_PAGE = 12;

const getLinkPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const OpensCell = ({ destination }: Readonly<{ destination: TCreativeListItem["destination"] }>) => {
  const { t } = useTranslation();
  if (!destination) return <span>-</span>;
  const isLink = destination.type === "link";
  const Icon = isLink ? LinkIcon : MessageCircleIcon;
  const text = isLink ? `${t("common.link")} · ${getLinkPath(destination.url)}` : destination.surveyName;
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={isLink ? destination.url : undefined}>
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
};

interface CreativesListProps {
  workspaceId: string;
  isReadOnly: boolean;
}

export const CreativesList = ({ workspaceId, isReadOnly }: Readonly<CreativesListProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [animationParent] = useAutoAnimate();
  const [filters, setFilters] = useState<TCreativeListFilters>(INITIAL_CREATIVE_FILTERS);
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);
  const [openFilter, setOpenFilter] = useState<"status" | "type" | null>(null);
  const debouncedName = useDebouncedValue(filters.name, 300);

  // Restore the toolbar from the last visit once mounted (localStorage doesn't exist on the server),
  // then keep it there, like the surveys and workflows lists.
  useEffect(() => {
    const stored = globalThis.localStorage?.getItem(FORMBRICKS_CREATIVES_FILTERS_KEY_LS) ?? null;
    const parsed = parseStoredCreativeFilters(stored);
    if (parsed) setFilters(parsed);
    else if (stored) globalThis.localStorage.removeItem(FORMBRICKS_CREATIVES_FILTERS_KEY_LS);
    setIsFilterInitialized(true);
  }, []);

  useEffect(() => {
    if (!isFilterInitialized) return;
    globalThis.localStorage?.setItem(FORMBRICKS_CREATIVES_FILTERS_KEY_LS, JSON.stringify(filters));
  }, [filters, isFilterInitialized]);

  const list = useCreativesList({
    workspaceId,
    limit: CREATIVES_PER_PAGE,
    filters: { ...filters, name: debouncedName.trim() },
    enabled: isFilterInitialized,
  });
  const { data: activeCreatives } = useActiveCreatives(workspaceId);

  // Pairwise over every Active creative in the workspace, so it runs when they change, not on every
  // keystroke in the search.
  const { overlaps, activeNames } = useMemo(
    () => ({
      overlaps: findCreativeOverlaps(activeCreatives ?? []),
      activeNames: new Map((activeCreatives ?? []).map((creative) => [creative.id, creative.name])),
    }),
    [activeCreatives]
  );

  const statusOptions: TFilterOption<CreativeDisplayStatusZodType>[] = [
    { label: t("common.draft"), value: "draft" },
    { label: t("common.scheduled"), value: "scheduled" },
    { label: t("common.active"), value: "active" },
    { label: t("common.paused"), value: "paused" },
    { label: t("common.closed"), value: "closed" },
    { label: t("common.archived"), value: "archived", separatorBefore: true },
  ];
  const typeOptions: TFilterOption<CreativeTypeZodType>[] = [
    { label: t("workspace.creatives.type_feedback_button"), value: "feedbackButton" },
    { label: t("workspace.creatives.type_banner"), value: "banner" },
  ];
  const toggle = <K extends "displayStatuses" | "types">(key: K, value: TCreativeListFilters[K][number]) =>
    setFilters((current) => {
      const selected: string[] = current[key];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [key]: next };
    });

  const hasFilters = hasActiveCreativeFilters(filters);
  const getRowHref = (creative: TCreativeListItem) =>
    creative.displayStatus === "draft"
      ? getCreativeEditPath(workspaceId, creative.id)
      : getCreativeSummaryPath(workspaceId, creative.id);

  let listContent: React.ReactNode;
  if (list.isPending) {
    listContent = <CreativesListBodySkeleton />;
  } else if (list.isError && list.creatives.length === 0) {
    listContent = (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
        <p>{getV3ApiErrorMessage(list.error, t("common.something_went_wrong_please_try_again"))}</p>
        <Button variant="secondary" size="sm" onClick={() => list.refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    );
  } else if (list.creatives.length === 0) {
    // The toolbar stays put either way, so the filter that emptied the list stays reachable.
    listContent = (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <PanelTopIcon className="size-8 text-slate-400" />
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">
            {hasFilters ? t("workspace.creatives.no_matches") : t("workspace.creatives.empty_title")}
          </h3>
          {hasFilters ? null : (
            <p className="text-sm text-balance text-slate-600">
              {t("workspace.creatives.empty_description")}
            </p>
          )}
        </div>
      </div>
    );
  } else {
    listContent = (
      <div>
        <div ref={animationParent} className="space-y-3">
          <CardTableHeader className={GRID}>
            <div className="col-span-2 place-self-start">{t("common.name")}</div>
            <div className="col-span-1">{t("common.status")}</div>
            <div className="col-span-1">{t("common.type")}</div>
            <div className="col-span-1">{t("workspace.creatives.column_opens")}</div>
            <div className="col-span-1">{t("common.created_at")}</div>
            <div className="col-span-1">{t("common.updated_at")}</div>
            <div className="col-span-1">{t("common.created_by")}</div>
          </CardTableHeader>
          {list.creatives.map((creative) => {
            const overlapNames = (overlaps.get(creative.id) ?? []).map((id) => activeNames.get(id) ?? id);
            return (
              <CardTableRow
                key={creative.id}
                href={getRowHref(creative)}
                className={GRID}
                actions={
                  isReadOnly ? undefined : (
                    <CreativeListActions workspaceId={workspaceId} creative={creative} />
                  )
                }>
                <div className="col-span-2 flex max-w-full items-center gap-2 justify-self-start text-sm font-medium text-slate-900">
                  <div className="min-w-0 truncate">
                    {creative.name || t("workspace.creatives.untitled_creative")}
                  </div>
                  <CreativeRowWarnings warnings={creative.warnings} overlapNames={overlapNames} />
                </div>
                <CreativeStatusPill
                  state={{ status: creative.displayStatus, reason: creative.displayStatusReason }}
                />
                <div className="col-span-1">
                  <CreativeTypeIndicator type={INDICATOR_TYPES[creative.type]} />
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-slate-600">
                  <OpensCell destination={creative.destination} />
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
                  {formatDateForDisplay(new Date(creative.createdAt), locale)}
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
                  {timeSince(creative.updatedAt, locale)}
                </div>
                <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
                  {creative.creator?.name ?? "-"}
                </div>
              </CardTableRow>
            );
          })}
        </div>

        {list.hasNextPage ? (
          <div className="flex justify-center py-5">
            <Button
              onClick={() => list.fetchNextPage()}
              variant="secondary"
              size="sm"
              loading={list.isFetchingNextPage}>
              {t("common.load_more")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

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
            selectedOptions={filters.displayStatuses}
            onToggleOption={(value) => toggle("displayStatuses", value)}
            isOpen={openFilter === "status"}
            onOpenChange={(open) => setOpenFilter(open ? "status" : null)}
          />
          <FilterDropdown
            title={t("common.type")}
            className="creativeFilterDropdown"
            options={typeOptions}
            selectedOptions={filters.types}
            onToggleOption={(value) => toggle("types", value)}
            isOpen={openFilter === "type"}
            onOpenChange={(open) => setOpenFilter(open ? "type" : null)}
          />
          {hasFilters ? (
            <Button
              size="sm"
              className="h-8"
              onClick={() => setFilters({ ...INITIAL_CREATIVE_FILTERS, sortBy: filters.sortBy })}>
              {t("common.clear_filters")}
              <X />
            </Button>
          ) : null}
        </div>
        <CreativesSortDropdown
          sortBy={filters.sortBy}
          onSortChange={(sortBy) => setFilters((current) => ({ ...current, sortBy }))}
        />
      </div>
      {listContent}
    </div>
  );
};
