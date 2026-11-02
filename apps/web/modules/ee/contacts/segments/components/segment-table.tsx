"use client";

import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useColumnSizing } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { contactQueryKeys } from "../../lib/query-keys";
import { DEFAULT_SEGMENT_SORT, SEGMENT_SORT_VALUES, listSegments } from "../lib/v3-segments-client";
import { EditSegmentModal } from "./edit-segment-modal";
import { buildSegmentActivitySummaryFromSegments } from "./segment-activity-utils";
import { generateSegmentTableColumns } from "./segment-table-columns";

const SEGMENTS_PER_PAGE = 50;

interface SegmentTableProps {
  /** Every segment, private ones included: what the edit modal's activity summary reads. */
  allSegments: TSegmentWithSurveyRefs[];
  /** The public segments, for the edit modal's segment picker. */
  segments: TSegmentWithSurveyRefs[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
  workspaceId: string;
}

/** Segments on the shared table toolbar: search and sort, on the server (no filters — three columns). */
export function SegmentTable({
  allSegments,
  segments,
  contactAttributeKeys,
  isContactsEnabled,
  isReadOnly,
  workspaceId,
}: Readonly<SegmentTableProps>) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const queryClient = useQueryClient();
  const [editingSegment, setEditingSegment] = useState<TSegmentWithSurveyRefs | null>(null);

  const tableState = useTableUrlState({
    properties: [],
    sortOptions: SEGMENT_SORT_VALUES,
    defaultSortBy: DEFAULT_SEGMENT_SORT,
  });
  const listParams: [string, string][] = [
    ["search", tableState.search.trim()],
    ["sortBy", tableState.sortBy],
  ];

  const query = useInfiniteQuery({
    queryKey: contactQueryKeys.segmentList(workspaceId, listParams),
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listSegments({
        workspaceId,
        limit: SEGMENTS_PER_PAGE,
        cursor: pageParam,
        search: tableState.search,
        sortBy: tableState.sortBy,
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  // Creating, editing or deleting a segment refreshes the page, which hands down a new segment set;
  // the list reads through TanStack Query, so it follows that change here.
  const segmentsVersion = allSegments
    .map((segment) => `${segment.id}:${String(segment.updatedAt)}`)
    .join("|");
  // Starts at the mounted set, so the first run does not cancel and repeat the list's initial request.
  const seenSegmentsVersion = useRef(segmentsVersion);
  useEffect(() => {
    if (seenSegmentsVersion.current === segmentsVersion) return;
    seenSegmentsVersion.current = segmentsVersion;
    void queryClient.invalidateQueries({ queryKey: [...contactQueryKeys.all, "segments", workspaceId] });
  }, [segmentsVersion, queryClient, workspaceId]);

  const rows = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.data), [query.data]);
  const columns = useMemo(() => generateSegmentTableColumns(t, locale), [locale, t]);
  const sizing = useColumnSizing(`${workspaceId}-segments-columnSizing`);
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    state: { columnSizing: sizing.columnSizing },
    ...sizing.tableOptions,
  });

  return (
    <div className="space-y-3">
      <TableToolbar
        settings={{
          sort: {
            options: [
              { value: "-updatedAt", label: t("common.table_toolbar.sort_recently_updated") },
              { value: "-createdAt", label: t("common.table_toolbar.sort_recently_created") },
              { value: "title", label: t("common.table_toolbar.sort_name") },
            ],
            value: tableState.sortBy,
            onChange: tableState.setSortBy,
          },
        }}
        search={{
          value: tableState.search,
          onChange: tableState.setSearch,
          placeholder: t("workspace.segments.search_segments"),
        }}
        matchCount={{ count: query.data?.pages[0]?.meta.totalCount ?? null }}
        isLoading={query.isLoading}
      />
      {query.isError && rows.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white py-16 text-slate-600">
          <p>{getV3ApiErrorMessage(query.error, t("common.something_went_wrong_please_try_again"))}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t("common.try_again")}
          </Button>
        </div>
      ) : (
        <ListTable
          table={table}
          testId="segments-table"
          isLoading={query.isLoading}
          hasFilters={tableState.search.trim().length > 0}
          onClearFilters={tableState.clearFilters}
          onRowClick={(row) => setEditingSegment(row.original)}
          isExpanded
          emptyContent={
            <div className="flex h-24 items-center justify-center">
              <p className="text-sm text-slate-400">{t("workspace.segments.create_your_first_segment")}</p>
            </div>
          }
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}

      {editingSegment && (
        <EditSegmentModal
          open={!!editingSegment}
          setOpen={(open) => !open && setEditingSegment(null)}
          currentSegment={editingSegment}
          activitySummary={buildSegmentActivitySummaryFromSegments(editingSegment, allSegments)}
          contactAttributeKeys={contactAttributeKeys}
          segments={segments}
          isContactsEnabled={isContactsEnabled}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
