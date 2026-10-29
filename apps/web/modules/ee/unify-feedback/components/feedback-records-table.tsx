"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TFunction } from "i18next";
import { ChevronDownIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TFeedbackSourceFieldMapping } from "@formbricks/types/feedback-source";
import { useOrganization } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { enrichmentStatusKeys } from "@/modules/ee/unify-feedback/enrichment-status/lib/query";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { feedbackRecordKeys, useFeedbackRecords } from "../hooks/use-feedback-records";
import { deleteFeedbackRecord, lookupFeedbackRecordContacts } from "../lib/api-client";
import { FieldTypeIcon } from "../lib/field-type-icons";
import {
  DEFAULT_RECORD_SORT,
  RECORD_SORT_VALUES,
  getRecordFilterProperties,
  getRecordSortOptions,
  toHubRecordQuery,
} from "../lib/table-filters";
import { formatFieldType, formatSourceType, resolveFeedbackDisplayText } from "../lib/utils";
import { CsvImportModal } from "../sources/components/csv-import-modal";
import { FeedbackRecordFormDrawer } from "./feedback-record-form-drawer";
import { TranslatedBadge } from "./translated-badge";

// A short month keeps the date and time readable in the column; the tooltip carries the long form.
const COMPACT_DATE_TIME: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

// Must not exceed the contact lookup's input cap (`userIds` is `.max(1000)`).
const CONTACT_RESOLVE_BATCH_SIZE = 1000;
const RECORD_COLUMN_IDS = [
  "select",
  "collectedAt",
  "sourceType",
  "sourceName",
  "fieldLabel",
  "fieldType",
  "value",
  "userId",
];

// resolvedText (translation-preferred) is computed once by the caller; null falls through to other types.
const formatValue = (
  record: FeedbackRecordData,
  resolvedText: string | null,
  t: TFunction,
  locale: string
): string => {
  if (resolvedText != null) return resolvedText;
  if (record.value_number != null) return String(record.value_number);
  if (record.value_boolean != null) return record.value_boolean ? t("common.yes") : t("common.no");
  if (record.value_date != null) return formatDateForDisplay(new Date(record.value_date), locale);
  return "—";
};

const RecordValueCell = ({ record, locale }: Readonly<{ record: FeedbackRecordData; locale: string }>) => {
  const { t } = useTranslation();
  const { text, isTranslated, original, langKey } = resolveFeedbackDisplayText(record);
  const value = formatValue(record, text, t, locale);
  return (
    <div className="flex min-w-0 items-center gap-1.5" title={value}>
      {value.length > 60 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block min-w-0 cursor-default truncate">{value}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
              {value}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="block min-w-0 truncate">{value}</span>
      )}
      {isTranslated && <TranslatedBadge langKey={langKey} original={original} locale={locale} />}
    </div>
  );
};

interface FeedbackRecordsTableProps {
  workspaceId: string;
  frdMap: Record<string, string>;
  csvSources: { id: string; name: string; fieldMappings: TFeedbackSourceFieldMapping[] }[];
  /** Every feedback source name in the workspace: the Source filter's values. */
  sourceNames: string[];
  canWrite: boolean;
  /** Owners/managers only — records are directory-level, not workspace-level (ENG-1770). */
  canDeleteRecords: boolean;
}

/** The table's columns, built outside the component so each cell renderer is not a nested component. */
const getRecordColumns = ({
  t,
  locale,
  workspaceId,
  contactIdByUserId,
  canDeleteRecords,
  onOpenRecord,
}: {
  t: TFunction;
  locale: string;
  workspaceId: string;
  contactIdByUserId: Record<string, string>;
  canDeleteRecords: boolean;
  onOpenRecord: (recordId: string) => void;
}): ColumnDef<FeedbackRecordData>[] => {
  const dataColumns: ColumnDef<FeedbackRecordData>[] = [
    {
      id: "collectedAt",
      header: t("workspace.unify.collected_at"),
      size: 225,
      cell: ({ row }) => {
        const date = new Date(row.original.collected_at);
        return (
          <span className="truncate text-slate-500" title={formatDateTimeForDisplay(date, locale)}>
            {formatDateTimeForDisplay(date, locale, COMPACT_DATE_TIME)}
          </span>
        );
      },
    },
    {
      id: "sourceType",
      header: t("workspace.unify.source_type"),
      size: 180,
      cell: ({ row }) => (
        <Badge
          text={formatSourceType(row.original.source_type, t)}
          type="gray"
          size="tiny"
          className="inline-block max-w-40 truncate align-middle"
        />
      ),
    },
    {
      id: "sourceName",
      header: t("workspace.unify.source_name"),
      size: 150,
      cell: ({ row }) => {
        const record = row.original;
        const isFormbricksSurveySource =
          (record.source_type === "formbricks" || record.source_type === "formbricks_survey") &&
          !!record.source_id;
        return isFormbricksSurveySource ? (
          <Link
            href={`/workspaces/${workspaceId}/surveys/${record.source_id}/summary`}
            className="block min-w-0 truncate text-slate-700 underline underline-offset-2 hover:text-slate-900">
            {record.source_name ?? "—"}
          </Link>
        ) : (
          <span className="block min-w-0 truncate" title={record.source_name ?? undefined}>
            {record.source_name ?? "—"}
          </span>
        );
      },
    },
    {
      id: "fieldLabel",
      header: t("workspace.unify.field_label"),
      size: 200,
      cell: ({ row }) => (
        // The row's keyboard entry point: opens the record like a click on the row does.
        <button
          type="button"
          onClick={() => onOpenRecord(row.original.id)}
          className="focus-visible:ring-ring block min-w-0 truncate text-left font-medium text-slate-900 hover:underline focus-visible:ring-1 focus-visible:outline-hidden">
          {row.original.field_label ?? row.original.field_id}
        </button>
      ),
    },
    {
      id: "fieldType",
      header: t("workspace.unify.field_type"),
      size: 110,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-600">
          <FieldTypeIcon fieldType={row.original.field_type} className="size-3.5" />
          {formatFieldType(row.original.field_type)}
        </span>
      ),
    },
    {
      id: "value",
      header: t("workspace.unify.value"),
      size: 180,
      cell: ({ row }) => <RecordValueCell record={row.original} locale={locale} />,
    },
    {
      id: "userId",
      header: t("workspace.unify.user_identifier"),
      size: 100,
      cell: ({ row }) => {
        const record = row.original;
        const contactId = record.user_id ? contactIdByUserId[record.user_id] : undefined;
        return record.user_id && contactId ? (
          <Link
            href={`/workspaces/${workspaceId}/contacts/${contactId}`}
            title={record.user_id}
            className="block min-w-0 truncate text-slate-700 underline underline-offset-2 hover:text-slate-900">
            {record.user_id}
          </Link>
        ) : (
          <span className="block min-w-0 truncate text-slate-500" title={record.user_id ?? undefined}>
            {record.user_id ?? "—"}
          </span>
        );
      },
    },
  ];
  if (!canDeleteRecords) return dataColumns;
  return [
    {
      id: "select",
      size: 44,
      header: ({ table }) => (
        <Checkbox
          aria-label={t("common.select_all")}
          checked={
            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
          }
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={row.original.field_label ?? row.original.field_id}
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        />
      ),
    },
    ...dataColumns,
  ];
};

export const FeedbackRecordsTable = ({
  workspaceId,
  frdMap,
  csvSources,
  sourceNames,
  canWrite,
  canDeleteRecords,
}: Readonly<FeedbackRecordsTableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  // Calendar days are cut in the organization's reporting zone, never the browser's (ADR 0015).
  const { organization } = useOrganization();
  const timeZone = getReportingTimeZone(organization?.displayTimeZone);
  // Reaches the same query client as the enrichment-status banner (provided above this table by
  // `feedback-records-page-client.tsx`), so a CSV import here can invalidate that read instead of
  // leaving it stale until a manual reload — see EnrichmentStatus's doc comment.
  const queryClient = useQueryClient();

  const [contactIdByUserId, setContactIdByUserId] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drawerRecordId, setDrawerRecordId] = useState<string | undefined>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [csvImportSource, setCsvImportSource] = useState<(typeof csvSources)[number] | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filterProperties = getRecordFilterProperties(t, { sourceNames });
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: RECORD_SORT_VALUES,
    defaultSortBy: DEFAULT_RECORD_SORT,
  });
  const filtersKey = JSON.stringify(tableState.filters);
  // Resolved once per filter change: a relative preset resolved on every render would change the query
  // (and refetch) on every render.
  const hubQuery = useMemo(
    () => toHubRecordQuery(tableState.filters, tableState.sortBy, timeZone),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filtersKey` stands in for the filter list
    [filtersKey, tableState.sortBy, timeZone]
  );
  const directoryIds = useMemo(() => Object.keys(frdMap).sort((a, b) => a.localeCompare(b)), [frdMap]);
  const directories = useMemo(
    () =>
      Object.entries(frdMap)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [frdMap]
  );

  const {
    records,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    matchCount,
  } = useFeedbackRecords({ workspaceId, directoryIds, query: hubQuery });

  const columnState = useTableColumnState({
    storagePrefix: `${workspaceId}-feedback-records`,
    columnIds: RECORD_COLUMN_IDS,
  });

  // Resolve any not-yet-known user_ids on the loaded records to contact ids. Chunked to stay within the
  // lookup's input cap; failures are swallowed since contact links are a non-critical enhancement.
  const resolveContactsForRecords = useCallback(
    async (recs: FeedbackRecordData[]) => {
      const missing = [
        ...new Set(recs.map((record) => record.user_id).filter((id): id is string => Boolean(id))),
      ].filter((id) => !(id in contactIdByUserId));
      if (missing.length === 0) return;
      try {
        for (let i = 0; i < missing.length; i += CONTACT_RESOLVE_BATCH_SIZE) {
          const batch = missing.slice(i, i + CONTACT_RESOLVE_BATCH_SIZE);
          const contactIds = await lookupFeedbackRecordContacts(workspaceId, batch);
          setContactIdByUserId((prev) => ({ ...prev, ...contactIds }));
        }
      } catch {
        // Ignore — contact deep-links are best-effort.
      }
    },
    [contactIdByUserId, workspaceId]
  );

  useEffect(() => {
    void resolveContactsForRecords(records);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per loaded set of records, not per resolved contact
  }, [records]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const toastId = toast.loading(t("workspace.unify.refreshing_feedback_records"));
    try {
      await refetch();
      setRowSelection({});
      toast.success(t("workspace.unify.feedback_records_refreshed"), { id: toastId });
    } catch {
      toast.error(t("workspace.unify.failed_to_load_feedback_records"), { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  // A CSV import creates records this list and the enrichment-status banner above it don't know
  // about yet — neither refetches on its own. Refresh the list the same way the manual Refresh
  // button does, and invalidate the banner's read so its next poll (or mount) picks up the new
  // backlog instead of staying dark until someone reloads the page.
  const handleImportComplete = () => {
    void handleRefresh();
    void queryClient.invalidateQueries({ queryKey: enrichmentStatusKeys.all });
  };

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !canDeleteRecords) return;
    setIsDeleting(true);
    const CHUNK_SIZE = 5;
    const failedIds: string[] = [];
    try {
      for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
        const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (recordId) => ({
            recordId,
            deleted: await deleteFeedbackRecord(recordId, workspaceId).then(
              () => true,
              () => false
            ),
          }))
        );
        results.forEach(({ recordId, deleted }) => {
          if (!deleted) failedIds.push(recordId);
        });
      }

      const succeeded = selectedIds.filter((id) => !failedIds.includes(id));
      if (succeeded.length > 0) {
        setRowSelection((prev) => {
          const next = { ...prev };
          succeeded.forEach((id) => delete next[id]);
          return next;
        });
        await queryClient.invalidateQueries({ queryKey: feedbackRecordKeys.all });
      }

      if (failedIds.length === 0) {
        toast.success(
          t("workspace.unify.feedback_records_deleted_successfully", { count: succeeded.length })
        );
      } else if (succeeded.length === 0) {
        toast.error(t("workspace.unify.failed_to_delete_feedback_records"));
      } else {
        toast.error(
          t("workspace.unify.feedback_records_partially_deleted", {
            succeeded: succeeded.length,
            total: selectedIds.length,
          })
        );
      }
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const openViewDrawer = (recordId: string) => {
    setDrawerRecordId(recordId);
    setIsDrawerOpen(true);
  };

  const columnLabels = [
    { id: "collectedAt", label: t("workspace.unify.collected_at") },
    { id: "sourceType", label: t("workspace.unify.source_type") },
    { id: "sourceName", label: t("workspace.unify.source_name") },
    { id: "fieldLabel", label: t("workspace.unify.field_label") },
    { id: "fieldType", label: t("workspace.unify.field_type") },
    { id: "value", label: t("workspace.unify.value") },
    { id: "userId", label: t("workspace.unify.user_identifier") },
  ];

  const columns = useMemo(
    () =>
      getRecordColumns({
        t,
        locale,
        workspaceId,
        contactIdByUserId,
        canDeleteRecords,
        onOpenRecord: openViewDrawer,
      }),
    [t, locale, workspaceId, contactIdByUserId, canDeleteRecords]
  );

  const table = useReactTable({
    data: records,
    columns,
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: canDeleteRecords,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      columnOrder: columnState.columnOrder,
      columnVisibility: columnState.columnVisibility,
      columnSizing: columnState.columnSizing,
    },
    ...columnState.sizingOptions,
  });

  const hasCsvSources = csvSources.length > 0;
  const hasFilters = tableState.filters.length > 0;

  const selectionContent =
    selectedIds.length > 0 ? (
      <div className="flex items-center gap-x-2 rounded-md bg-primary p-1 px-2 text-xs text-white">
        <span>{t("workspace.unify.feedback_records_count_selected", { count: selectedIds.length })}</span>
        <span aria-hidden="true">|</span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 border-none px-2"
          onClick={() => setRowSelection({})}>
          {t("common.clear_selection")}
        </Button>
        <span aria-hidden="true">|</span>
        <Button
          variant="secondary"
          size="sm"
          className="h-6 gap-1 px-2"
          onClick={() => setIsBulkDeleteDialogOpen(true)}>
          {t("common.delete")}
          <Trash2Icon />
        </Button>
      </div>
    ) : undefined;

  const actions = (
    <div className="flex items-center gap-2">
      {canWrite && hasCsvSources && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary">
              <PlusIcon className="size-4" />
              {t("workspace.unify.import_feedback")}
              <ChevronDownIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {csvSources.map((source) => (
              <DropdownMenuItem key={source.id} onClick={() => setCsvImportSource(source)}>
                {t("workspace.unify.import_via_source_name", { sourceName: source.name })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button size="sm" asChild>
        <Link href={`/workspaces/${workspaceId}/unify/sources`}>
          {t("workspace.unify.manage_feedback_sources")}
        </Link>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        aria-label={t("workspace.unify.refresh_feedback_records")}>
        <RefreshCwIcon className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <>
      <div className="space-y-3">
        <TableToolbar
          settings={{
            sort: {
              options: getRecordSortOptions(t),
              value: tableState.sortBy,
              onChange: tableState.setSortBy,
            },
            columns: {
              items: buildColumnSettings(
                columnLabels,
                columnState.columnOrder,
                columnState.columnVisibility,
                ["fieldLabel"]
              ),
              onVisibilityChange: (id, visible) =>
                columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
              onMove: columnState.moveColumn,
            },
          }}
          filter={{
            properties: filterProperties,
            filters: tableState.filters,
            onFiltersChange: (next) => {
              setRowSelection({});
              tableState.setFilters(next);
            },
          }}
          matchCount={{ count: matchCount }}
          actions={actions}
          selectionContent={selectionContent}
          isLoading={isLoading}
        />

        {isError && records.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-center">
            <p className="text-sm text-slate-500">
              {getV3ApiErrorMessage(error, t("workspace.unify.failed_to_load_feedback_records"))}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <ListTable
            table={table}
            testId="feedback-records-table"
            minWidth={1040}
            isLoading={isLoading}
            hasFilters={hasFilters}
            onClearFilters={tableState.clearFilters}
            onRowClick={(row) => openViewDrawer(row.original.id)}
            emptyContent={
              <div className="flex h-32 items-center justify-center px-4 text-center">
                <p className="text-sm text-slate-500">{t("workspace.unify.no_feedback_records")}</p>
              </div>
            }
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => void fetchNextPage()}
          />
        )}
      </div>

      <FeedbackRecordFormDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        workspaceId={workspaceId}
        directories={directories}
        canDelete={canDeleteRecords}
        recordId={drawerRecordId}
        onSuccess={handleRefresh}
      />

      <DeleteDialog
        open={isBulkDeleteDialogOpen}
        setOpen={setIsBulkDeleteDialogOpen}
        deleteWhat={t("workspace.unify.feedback_records")}
        text={t("workspace.unify.delete_feedback_records_confirmation", { count: selectedIds.length })}
        onDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />

      {csvImportSource && (
        <CsvImportModal
          open={csvImportSource !== null}
          onOpenChange={(open) => {
            if (!open) setCsvImportSource(null);
          }}
          feedbackSourceId={csvImportSource.id}
          workspaceId={workspaceId}
          fieldMappings={csvImportSource.fieldMappings}
          onImportComplete={handleImportComplete}
        />
      )}
    </>
  );
};
