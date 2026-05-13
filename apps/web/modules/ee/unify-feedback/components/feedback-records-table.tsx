"use client";

import { TFunction } from "i18next";
import {
  CalendarIcon,
  ChevronDownIcon,
  HashIcon,
  MessageSquareTextIcon,
  PlusIcon,
  RefreshCwIcon,
  ToggleLeftIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { listFeedbackRecordsAction } from "@/lib/connector/actions";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { deleteFeedbackRecordAction } from "../actions";
import { formatSourceType } from "../lib/utils";
import { CsvImportModal } from "../sources/components/csv-import-modal";
import { FeedbackRecordFormDrawer } from "./feedback-record-form-drawer";

const RECORDS_PER_PAGE = 50;

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <TypeIcon className="h-3.5 w-3.5" />,
  categorical: <HashIcon className="h-3.5 w-3.5" />,
  nps: <HashIcon className="h-3.5 w-3.5" />,
  csat: <HashIcon className="h-3.5 w-3.5" />,
  ces: <HashIcon className="h-3.5 w-3.5" />,
  rating: <HashIcon className="h-3.5 w-3.5" />,
  number: <HashIcon className="h-3.5 w-3.5" />,
  boolean: <ToggleLeftIcon className="h-3.5 w-3.5" />,
  date: <CalendarIcon className="h-3.5 w-3.5" />,
};

const formatValue = (record: FeedbackRecordData, t: TFunction, locale: string): string => {
  if (record.value_text != null) return record.value_text;
  if (record.value_number != null) return String(record.value_number);
  if (record.value_boolean != null) return record.value_boolean ? t("common.yes") : t("common.no");
  if (record.value_date != null) return formatDateForDisplay(new Date(record.value_date), locale);
  return "—";
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

interface FeedbackRecordsTableProps {
  workspaceId: string;
  initialRecords: FeedbackRecordData[];
  initialCursors: Record<string, string>;
  frdMap: Record<string, string>;
  csvSources: { id: string; name: string }[];
  canWrite: boolean;
}

export const FeedbackRecordsTable = ({
  workspaceId,
  initialRecords,
  initialCursors,
  frdMap,
  csvSources,
  canWrite,
}: Readonly<FeedbackRecordsTableProps>) => {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<FeedbackRecordData[]>(initialRecords);
  const [cursors, setCursors] = useState<Record<string, string>>(initialCursors);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("edit");
  const [drawerRecordId, setDrawerRecordId] = useState<string | undefined>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [csvImportSource, setCsvImportSource] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasMore = Object.keys(cursors).length > 0;
  const selectedCount = selectedIds.size;
  const allOnPageSelected = records.length > 0 && records.every((record) => selectedIds.has(record.id));
  const someOnPageSelected = records.some((record) => selectedIds.has(record.id));

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        records.forEach((record) => next.add(record.id));
      } else {
        records.forEach((record) => next.delete(record.id));
      }
      return next;
    });
  };

  const toggleOne = (recordId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(recordId);
      } else {
        next.delete(recordId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const directories = useMemo(
    () =>
      Object.entries(frdMap)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [frdMap]
  );

  type FetchResult =
    | { ok: true; records: FeedbackRecordData[]; newCursors: Record<string, string> }
    | { ok: false; errorMessage: string };

  const fetchRecords = async (mode: "refresh" | "loadMore"): Promise<FetchResult> => {
    const directoryIds = Object.keys(frdMap);
    const frdIdsToFetch = mode === "refresh" ? directoryIds : directoryIds.filter((id) => cursors[id]);

    if (frdIdsToFetch.length === 0) {
      return { ok: true, records: [], newCursors: {} };
    }

    const results = await Promise.all(
      frdIdsToFetch.map((frdId) =>
        listFeedbackRecordsAction({
          workspaceId,
          frdId,
          limit: RECORDS_PER_PAGE,
          ...(mode === "loadMore" && cursors[frdId] ? { cursor: cursors[frdId] } : {}),
        })
      )
    );

    const firstFailure = results.find((result) => !result?.data);
    if (firstFailure) {
      return {
        ok: false,
        errorMessage:
          getFormattedErrorMessage(firstFailure) ?? t("workspace.unify.failed_to_load_feedback_records"),
      };
    }

    const fetchedRecords = results.flatMap((result) => result?.data?.data ?? []);

    const newCursors: Record<string, string> = {};
    for (let i = 0; i < frdIdsToFetch.length; i++) {
      const nextCursor = results[i]?.data?.next_cursor;
      if (nextCursor) {
        newCursors[frdIdsToFetch[i]] = nextCursor;
      }
    }

    return { ok: true, records: fetchedRecords, newCursors };
  };

  const handleRefresh = async () => {
    if (isRefreshing || isLoadingMore) return;
    setIsRefreshing(true);
    setError(null);

    const toastId = toast.loading(t("workspace.unify.refreshing_feedback_records"));
    const result = await fetchRecords("refresh");

    if (!result.ok) {
      toast.error(result.errorMessage, { id: toastId });
      setIsRefreshing(false);
      return;
    }

    const mergedRecords = result.records.toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1));
    setRecords(mergedRecords);
    setCursors(result.newCursors);
    setSelectedIds(new Set());
    setIsRefreshing(false);
    toast.success(t("workspace.unify.feedback_records_refreshed"), { id: toastId });
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || isRefreshing || !hasMore) return;
    setIsLoadingMore(true);

    const result = await fetchRecords("loadMore");

    if (!result.ok) {
      toast.error(result.errorMessage);
      setIsLoadingMore(false);
      return;
    }

    setRecords((prev) =>
      [...prev, ...result.records].toSorted((a, b) => (a.collected_at < b.collected_at ? 1 : -1))
    );
    setCursors(result.newCursors);
    setIsLoadingMore(false);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-center">
          <MessageSquareTextIcon className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">{error}</p>
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const isEmpty = records.length === 0 && !isRefreshing;

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsDeleting(true);
    const CHUNK_SIZE = 5;
    const failedIds: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (recordId) => ({
            recordId,
            result: await deleteFeedbackRecordAction({ workspaceId, recordId }),
          }))
        );
        results.forEach(({ recordId, result }) => {
          if (!result?.data) failedIds.push(recordId);
        });
      }

      const succeeded = ids.filter((id) => !failedIds.includes(id));
      if (succeeded.length > 0) {
        setRecords((prev) => prev.filter((record) => !succeeded.includes(record.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          succeeded.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failedIds.length === 0) {
        toast.success(
          t("workspace.unify.feedback_records_deleted_successfully", { count: succeeded.length })
        );
      } else if (succeeded.length === 0) {
        toast.error(t("workspace.unify.failed_to_load_feedback_records"));
      } else {
        toast.error(`${succeeded.length}/${ids.length} deleted`);
      }
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const openEditDrawer = (recordId: string) => {
    setDrawerMode("edit");
    setDrawerRecordId(recordId);
    setIsDrawerOpen(true);
  };

  const openCreateDrawer = () => {
    setDrawerMode("create");
    setDrawerRecordId(undefined);
    setIsDrawerOpen(true);
  };

  const hasCsvSources = csvSources.length > 0;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {selectedCount > 0 ? (
            <div className="flex items-center gap-x-2 rounded-md bg-primary p-1 px-2 text-xs text-white">
              <span className="lowercase">
                {`${selectedCount} ${t("workspace.unify.feedback_records").toLowerCase()} ${t("common.selected")}`}
              </span>
              <span>|</span>
              <Button variant="outline" size="sm" className="h-6 border-none px-2" onClick={clearSelection}>
                {t("common.clear_selection")}
              </Button>
              <span>|</span>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 gap-1 px-2"
                onClick={() => setIsBulkDeleteDialogOpen(true)}>
                {t("common.delete")}
                <Trash2Icon />
              </Button>
            </div>
          ) : isEmpty ? (
            <span />
          ) : (
            <p className="text-sm text-slate-500">
              {t("workspace.unify.showing_count_loaded", {
                count: records.length,
              })}
            </p>
          )}
          <div className="flex items-center gap-2">
            {canWrite &&
              (hasCsvSources ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <PlusIcon className="h-4 w-4" />
                      {t("workspace.unify.add_feedback_record")}
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openCreateDrawer}>
                      {t("workspace.unify.add_feedback_record")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {csvSources.map((source) => (
                      <DropdownMenuItem
                        key={source.id}
                        onClick={() => {
                          setCsvImportSource(source);
                        }}>
                        {t("workspace.unify.import_via_source_name", { sourceName: source.name })}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" variant="secondary" onClick={openCreateDrawer}>
                  <PlusIcon className="h-4 w-4" />
                  {t("workspace.unify.add_feedback_record")}
                </Button>
              ))}
            <Button size="sm" asChild>
              <Link href={`/workspaces/${workspaceId}/settings/workspace/feedback-sources`}>
                {t("workspace.unify.manage_feedback_sources")}
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingMore}
              aria-label={t("workspace.unify.refresh_feedback_records")}>
              <RefreshCwIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-900 [&>th]:font-semibold">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      aria-label={t("common.select_all")}
                      checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
                    />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.collected_at")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.source_type")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.source_name")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.field_label")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.field_type")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.value")}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t("workspace.unify.user_identifier")}</th>
                </tr>
              </thead>
              {isEmpty ? (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      <div className="flex h-32 items-center justify-center">
                        <p className="text-sm text-slate-500">{t("workspace.unify.no_feedback_records")}</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <FeedbackRecordRow
                      key={record.id}
                      record={record}
                      workspaceId={workspaceId}
                      locale={i18n.resolvedLanguage ?? i18n.language ?? "en-US"}
                      t={t}
                      isSelected={selectedIds.has(record.id)}
                      onSelectChange={(checked) => toggleOne(record.id, checked)}
                      onClick={() => openEditDrawer(record.id)}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>

        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore || isRefreshing}
              loading={isLoadingMore}>
              {t("common.load_more")}
            </Button>
          </div>
        )}
      </div>

      <FeedbackRecordFormDrawer
        mode={drawerMode}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        workspaceId={workspaceId}
        directories={directories}
        canWrite={canWrite}
        recordId={drawerMode === "edit" ? drawerRecordId : undefined}
        onSuccess={handleRefresh}
      />

      <DeleteDialog
        open={isBulkDeleteDialogOpen}
        setOpen={setIsBulkDeleteDialogOpen}
        deleteWhat={t("workspace.unify.feedback_records")}
        text={t("workspace.unify.delete_feedback_records_confirmation", { count: selectedCount })}
        onDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />

      {csvImportSource && (
        <CsvImportModal
          open={csvImportSource !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCsvImportSource(null);
            }
          }}
          connectorId={csvImportSource.id}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
};

const FeedbackRecordRow = ({
  record,
  workspaceId,
  locale,
  t,
  isSelected,
  onSelectChange,
  onClick,
}: {
  record: FeedbackRecordData;
  workspaceId: string;
  locale: string;
  t: TFunction;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onClick: () => void;
}) => {
  const value = formatValue(record, t, locale);
  const isLongValue = value.length > 60;
  const isFormbricksSurveySource =
    (record.source_type === "formbricks" || record.source_type === "formbricks_survey") && !!record.source_id;
  const surveySummaryHref = `/workspaces/${workspaceId}/surveys/${record.source_id}/summary`;

  return (
    <tr
      className={`cursor-pointer text-sm text-slate-700 transition-colors focus-within:bg-slate-50 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${isSelected ? "bg-slate-50" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={record.field_label ?? record.field_id}
      aria-selected={isSelected}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}>
      <td
        className="w-10 px-4 py-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}>
        <Checkbox
          aria-label={record.field_label ?? record.field_id}
          checked={isSelected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
        {formatDateTimeForDisplay(new Date(record.collected_at), locale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge text={formatSourceType(record.source_type, t)} type="gray" size="tiny" />
      </td>
      <td className="max-w-[150px] truncate px-4 py-3" title={record.source_name ?? undefined}>
        {isFormbricksSurveySource ? (
          <Link
            href={surveySummaryHref}
            className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
            onClick={(event) => event.stopPropagation()}>
            {record.source_name ?? "—"}
          </Link>
        ) : (
          <span>{record.source_name ?? "—"}</span>
        )}
      </td>
      <td className="max-w-[200px] truncate px-4 py-3" title={record.field_label ?? undefined}>
        {record.field_label ?? record.field_id}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="inline-flex items-center gap-1 text-slate-600">
          {FIELD_TYPE_ICONS[record.field_type] ?? <HashIcon className="h-3.5 w-3.5" />}
          {record.field_type}
        </span>
      </td>
      <td className="max-w-[250px] px-4 py-3">
        {isLongValue ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default truncate">{truncate(value, 60)}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                {value}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span>{value}</span>
        )}
      </td>
      <td className="max-w-[120px] truncate px-4 py-3 text-slate-500" title={record.user_id}>
        {record.user_id ?? "—"}
      </td>
    </tr>
  );
};
