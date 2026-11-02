"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { LinkIcon, MessageCircleIcon, PanelTopIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { removeStaleFilterStorage } from "@/lib/stale-filter-storage";
import { timeSince } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { useActiveCreatives, useCreativesList } from "../hooks/use-creatives-list";
import { type TCreativesAccess, canWriteCreatives } from "../lib/access-rules";
import { getLinkTargetLabel } from "../lib/link-target";
import type { TCreativeListItem } from "../lib/list-api";
import {
  CREATIVE_SORT_VALUES,
  DEFAULT_CREATIVE_SORT,
  INITIAL_CREATIVE_FILTERS,
  getCreativeFilterProperties,
  getCreativeSortOptions,
  isShowingArchived,
  setShowArchived,
  toCreativeListFilters,
} from "../lib/list-filters";
import { findCreativeOverlaps } from "../lib/overlap";
import { getCreativeEditPath, getCreativeSummaryPath } from "../lib/paths";
import { getUiLocale } from "../lib/ui-locale";
import { CreativeTypeIcon } from "./creative-icons";
import { CreativeListActions } from "./creative-list-actions";
import { CreativeRowWarnings } from "./creative-row-warnings";
import { CreativeStatusPill } from "./creative-status-pill";

const CREATIVES_PER_PAGE = 12;
const CREATIVE_COLUMN_IDS = ["name", "status", "opens", "createdAt", "updatedAt", "createdBy", "actions"];
// One shared empty list, so a filter that matches nothing does not hand the table a new array each render.
const NO_CREATIVES: TCreativeListItem[] = [];

const OpensCell = ({ destination }: Readonly<{ destination: TCreativeListItem["destination"] }>) => {
  const { t } = useTranslation();
  if (!destination) return <span className="text-slate-400">—</span>;
  const isLink = destination.type === "link";
  const Icon = isLink ? LinkIcon : MessageCircleIcon;
  const text = isLink
    ? `${t("common.link")} · ${getLinkTargetLabel(destination.url)}`
    : destination.surveyName;
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={isLink ? destination.url : undefined}>
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
};

const CreativesEmptyState = () => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <PanelTopIcon className="size-8 text-slate-400" />
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">{t("workspace.creatives.empty_title")}</h3>
        <p className="text-sm text-balance text-slate-600">{t("workspace.creatives.empty_description")}</p>
      </div>
    </div>
  );
};

/** The table's columns, built outside the component so each cell renderer is not a nested component. */
const getCreativeColumns = ({
  t,
  locale,
  workspaceId,
  isReadOnly,
  creativesAccess,
  getRowHref,
  getOverlapNames,
}: {
  t: TFunction;
  locale: ReturnType<typeof getUiLocale>;
  workspaceId: string;
  isReadOnly: boolean;
  creativesAccess: TCreativesAccess;
  getRowHref: (creative: TCreativeListItem) => string;
  getOverlapNames: (creative: TCreativeListItem) => string[];
}): ColumnDef<TCreativeListItem>[] => [
  {
    id: "name",
    header: t("common.name"),
    size: 260,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <CreativeTypeIcon type={row.original.type} />
        <Link
          href={getRowHref(row.original)}
          className="focus-visible:ring-ring min-w-0 truncate font-medium text-slate-900 hover:underline focus-visible:ring-1 focus-visible:outline-hidden">
          {row.original.name || t("workspace.creatives.untitled_creative")}
        </Link>
        <CreativeRowWarnings warnings={row.original.warnings} overlapNames={getOverlapNames(row.original)} />
      </div>
    ),
  },
  {
    id: "status",
    header: t("common.status"),
    size: 160,
    cell: ({ row }) => (
      <CreativeStatusPill
        state={{ status: row.original.displayStatus, reason: row.original.displayStatusReason }}
      />
    ),
  },
  {
    id: "opens",
    header: t("workspace.creatives.column_opens"),
    size: 180,
    cell: ({ row }) => (
      <span className="min-w-0 text-slate-500">
        <OpensCell destination={row.original.destination} />
      </span>
    ),
  },
  {
    id: "createdAt",
    header: t("common.created_at"),
    size: 150,
    cell: ({ row }) => (
      <span className="truncate text-slate-500">
        {formatDateForDisplay(new Date(row.original.createdAt), locale)}
      </span>
    ),
  },
  {
    id: "updatedAt",
    header: t("common.updated_at"),
    size: 150,
    cell: ({ row }) => (
      <span className="truncate text-slate-500">{timeSince(row.original.updatedAt, locale)}</span>
    ),
  },
  {
    id: "createdBy",
    header: t("common.created_by"),
    size: 150,
    cell: ({ row }) => <span className="truncate text-slate-500">{row.original.creator?.name ?? "—"}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("common.actions")}</span>,
    size: 64,
    cell: ({ row }) =>
      isReadOnly ? null : (
        <div className="flex w-full justify-end">
          <CreativeListActions
            workspaceId={workspaceId}
            creative={row.original}
            creativesAccess={creativesAccess}
          />
        </div>
      ),
  },
];

interface CreativesListProps {
  workspaceId: string;
  isReadOnly: boolean;
  /** `full` or `windDown`: in wind-down rows open the summary and their menu only takes creatives down. */
  creativesAccess: TCreativesAccess;
}

/** The Creatives list as a table on the shared toolbar, like Surveys and Workflows. */
export const CreativesList = ({ workspaceId, isReadOnly, creativesAccess }: Readonly<CreativesListProps>) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = getUiLocale(i18n);

  useEffect(() => removeStaleFilterStorage(globalThis.window?.localStorage), []);

  const filterProperties = getCreativeFilterProperties(t);
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: CREATIVE_SORT_VALUES,
    defaultSortBy: DEFAULT_CREATIVE_SORT,
  });
  const listFilters = toCreativeListFilters(tableState.filters, tableState.search, tableState.sortBy);
  const hasFilters = tableState.filters.length > 0 || tableState.search.trim().length > 0;
  const columnState = useTableColumnState({
    storagePrefix: `${workspaceId}-creatives`,
    columnIds: CREATIVE_COLUMN_IDS,
  });

  const list = useCreativesList({
    workspaceId,
    limit: CREATIVES_PER_PAGE,
    filters: listFilters ?? INITIAL_CREATIVE_FILTERS,
    // Filters that exclude every status or type cannot match anything; there is nothing to ask the API.
    enabled: listFilters !== null,
  });
  const { data: activeCreatives } = useActiveCreatives(workspaceId);

  // Pairwise over every Active creative in the workspace, so it runs when they change, not on every
  // search.
  const { overlaps, activeNames } = useMemo(
    () => ({
      overlaps: findCreativeOverlaps(activeCreatives ?? []),
      activeNames: new Map((activeCreatives ?? []).map((creative) => [creative.id, creative.name])),
    }),
    [activeCreatives]
  );

  const rows = listFilters === null ? NO_CREATIVES : list.creatives;

  const columns = useMemo(() => {
    // A draft has nothing to count yet, so it opens in the editor, unless the editor is out of reach.
    const getRowHref = (creative: TCreativeListItem) =>
      creative.displayStatus === "draft" && canWriteCreatives(creativesAccess)
        ? getCreativeEditPath(workspaceId, creative.id)
        : getCreativeSummaryPath(workspaceId, creative.id);
    const getOverlapNames = (creative: TCreativeListItem) =>
      (overlaps.get(creative.id) ?? []).map((id) => activeNames.get(id) ?? id);
    return {
      getRowHref,
      defs: getCreativeColumns({
        t,
        locale,
        workspaceId,
        isReadOnly,
        creativesAccess,
        getRowHref,
        getOverlapNames,
      }),
    };
  }, [t, locale, workspaceId, isReadOnly, creativesAccess, overlaps, activeNames]);

  const table = useReactTable({
    data: rows,
    columns: columns.defs,
    getRowId: (creative) => creative.id,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnOrder: columnState.columnOrder,
      columnVisibility: columnState.columnVisibility,
      columnSizing: columnState.columnSizing,
    },
    ...columnState.sizingOptions,
  });

  const columnLabels = [
    { id: "name", label: t("common.name") },
    { id: "status", label: t("common.status") },
    { id: "opens", label: t("workspace.creatives.column_opens") },
    { id: "createdAt", label: t("common.created_at") },
    { id: "updatedAt", label: t("common.updated_at") },
    { id: "createdBy", label: t("common.created_by") },
  ];

  return (
    <div className="space-y-3">
      <TableToolbar
        settings={{
          sort: {
            options: getCreativeSortOptions(t),
            value: tableState.sortBy,
            onChange: tableState.setSortBy,
          },
          toggles: [
            {
              id: "show-archived",
              label: t("common.table_toolbar.show_archived"),
              checked: isShowingArchived(tableState.filters),
              onCheckedChange: (checked) =>
                tableState.setFilters(setShowArchived(tableState.filters, checked)),
            },
          ],
          columns: {
            items: buildColumnSettings(columnLabels, columnState.columnOrder, columnState.columnVisibility, [
              "name",
            ]),
            onVisibilityChange: (id, visible) =>
              columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
            onMove: columnState.moveColumn,
          },
        }}
        search={{
          value: tableState.search,
          onChange: tableState.setSearch,
          placeholder: t("workspace.creatives.search_placeholder"),
        }}
        filter={{
          properties: filterProperties,
          filters: tableState.filters,
          onFiltersChange: tableState.setFilters,
        }}
        isLoading={list.isLoading}
      />
      {list.isError && rows.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
          <p>{getV3ApiErrorMessage(list.error, t("common.something_went_wrong_please_try_again"))}</p>
          <Button variant="secondary" size="sm" onClick={() => list.refetch()}>
            {t("common.try_again")}
          </Button>
        </div>
      ) : (
        <ListTable
          table={table}
          testId="creatives-list-table"
          isLoading={listFilters !== null && list.isPending}
          hasFilters={hasFilters}
          onClearFilters={tableState.clearFilters}
          onRowClick={(row) => router.push(columns.getRowHref(row.original))}
          emptyContent={<CreativesEmptyState />}
          hasNextPage={listFilters !== null && Boolean(list.hasNextPage)}
          isFetchingNextPage={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
        />
      )}
    </div>
  );
};
