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
  TypeIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TFeedbackSourceFieldMapping } from "@formbricks/types/feedback-source";
import { getFeedbackRecordContactsAction, listFeedbackRecordsAction } from "@/lib/feedback-source/actions";
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
import { formatFieldType, formatSourceType, resolveFeedbackDisplayText } from "../lib/utils";
import { CsvImportModal } from "../sources/components/csv-import-modal";
import { FeedbackRecordFormDrawer } from "./feedback-record-form-drawer";
import { FeedbackRecordsTableToolbarLeft } from "./feedback-records-table-toolbar-left";
import { TranslatedBadge } from "./translated-badge";

const RECORDS_PER_PAGE = 50;
// Must not exceed the getFeedbackRecordContactsAction input cap (`userIds` is `.max(1000)`).
const CONTACT_RESOLVE_BATCH_SIZE = 1000;

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <TypeIcon className="size-3.5" />,
  categorical: <HashIcon className="size-3.5" />,
  nps: <HashIcon className="size-3.5" />,
  csat: <HashIcon className="size-3.5" />,
  ces: <HashIcon className="size-3.5" />,
  rating: <HashIcon className="size-3.5" />,
  number: <HashIcon className="size-3.5" />,
  boolean: <ToggleLeftIcon className="size-3.5" />,
  date: <CalendarIcon className="size-3.5" />,
};

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

interface FeedbackRecordsTableProps {
  workspaceId: string;
  initialRecords: FeedbackRecordData[];
  initialCursors: Record<string, string>;
  initialContactIdByUserId: Record<string, string>;
  frdMap: Record<string, string>;
  csvSources: { id: string; name: string; fieldMappings: TFeedbackSourceFieldMapping[] }[];
  canWrite: boolean;
}

interface FeedbackRecordRowProps {
  record: FeedbackRecordData;
  workspaceId: string;
  contactId?: string;
  locale: string;
  t: TFunction;
  canWrite: boolean;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onClick: () => void;
}

export const FeedbackRecordsTable = ({
  workspaceId,
  initialRecords,
  initialCursors,
  initialContactIdByUserId,
  frdMap,
  csvSources,
  canWrite,
}: Readonly<FeedbackRecordsTableProps>) => {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<FeedbackRecordData[]>(initialRecords);
  const [cursors, setCursors] = useState<Record<string, string>>(initialCursors);
  const [contactIdByUserId, setContactIdByUserId] =
    useState<Record<string, string>>(initialContactIdByUserId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("edit");
  const [drawerRecordId, setDrawerRecordId] = useState<string | undefined>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [csvImportSource, setCsvImportSource] = useState<{
    id: string;
    name: string;
    fieldMappings: TFeedbackSourceFieldMapping[];
  } | null>(null);
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

  // Resolve any not-yet-known user_ids from a freshly fetched page to contact ids. Chunked to stay
  // within the action's input cap, and failures are swallowed since contact links are a non-critical
  // enhancement — the records still render without them.
  const resolveContactsForRecords = useCallback(
    async (recs: FeedbackRecordData[]) => {
      const missing = [
        ...new Set(recs.map((record) => record.user_id).filter((id): id is string => Boolean(id))),
      ].filter((id) => !(id in contactIdByUserId));
      if (missing.length === 0) return;

      try {
        for (let i = 0; i < missing.length; i += CONTACT_RESOLVE_BATCH_SIZE) {
          const batch = missing.slice(i, i + CONTACT_RESOLVE_BATCH_SIZE);
          const result = await getFeedbackRecordContactsAction({ workspaceId, userIds: batch });
          if (result?.data) {
            setContactIdByUserId((prev) => ({ ...prev, ...result.data }));
          }
        }
      } catch {
        // Ignore — contact deep-links are best-effort.
      }
    },
    [contactIdByUserId, workspaceId]
  );

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
    void resolveContactsForRecords(mergedRecords);
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
    void resolveContactsForRecords(result.records);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-center">
          <MessageSquareTextIcon className="size-8 text-slate-400" />
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
        toast.error(t("workspace.unify.failed_to_delete_feedback_records"));
      } else {
        toast.error(
          t("workspace.unify.feedback_records_partially_deleted", {
            succeeded: succeeded.length,
            total: ids.length,
          })
        );
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

  let headerCheckboxChecked: boolean | "indeterminate" = false;
  if (allOnPageSelected) {
    headerCheckboxChecked = true;
  } else if (someOnPageSelected) {
    headerCheckboxChecked = "indeterminate";
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <FeedbackRecordsTableToolbarLeft
            selectedCount={selectedCount}
            recordsCount={records.length}
            isEmpty={isEmpty}
            onClearSelection={clearSelection}
            onBulkDelete={() => setIsBulkDeleteDialogOpen(true)}
          />
          <div className="flex items-center gap-2">
            {canWrite &&
              (hasCsvSources ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary">
                      <PlusIcon className="size-4" />
                      {t("workspace.unify.add_feedback_record")}
                      <ChevronDownIcon className="size-4" />
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
                  <PlusIcon className="size-4" />
                  {t("workspace.unify.add_feedback_record")}
                </Button>
              ))}
            <Button size="sm" asChild>
              <Link href={`/workspaces/${workspaceId}/unify/sources`}>
                {t("workspace.unify.manage_feedback_sources")}
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingMore}
              aria-label={t("workspace.unify.refresh_feedback_records")}>
              <RefreshCwIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed">
              <colgroup>
                {canWrite && <col className="w-10" />}
                <col className="w-40" />
                <col className="w-40" />
                <col className="w-40" />
                <col className="w-52" />
                <col className="w-28" />
                <col />
                <col className="w-44" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-900 [&>th]:font-semibold">
                  {canWrite && (
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        aria-label={t("common.select_all")}
                        checked={headerCheckboxChecked}
                        onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.collected_at")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.source_type")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.source_name")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.field_label")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.field_type")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.value")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("workspace.unify.user_identifier")}</th>
                </tr>
              </thead>
              {isEmpty ? (
                <tbody>
                  <tr>
                    <td colSpan={canWrite ? 8 : 7}>
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
                      contactId={record.user_id ? contactIdByUserId[record.user_id] : undefined}
                      locale={i18n.resolvedLanguage ?? i18n.language ?? "en-US"}
                      t={t}
                      canWrite={canWrite}
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
          feedbackSourceId={csvImportSource.id}
          workspaceId={workspaceId}
          fieldMappings={csvImportSource.fieldMappings}
        />
      )}
    </>
  );
};

const FeedbackRecordRow = ({
  record,
  workspaceId,
  contactId,
  locale,
  t,
  canWrite,
  isSelected,
  onSelectChange,
  onClick,
}: Readonly<FeedbackRecordRowProps>) => {
  const { text, isTranslated, original, langKey } = resolveFeedbackDisplayText(record);
  const value = formatValue(record, text, t, locale);
  const isLongValue = value.length > 60;
  const collectedAt = formatDateTimeForDisplay(new Date(record.collected_at), locale);
  const isFormbricksSurveySource =
    (record.source_type === "formbricks" || record.source_type === "formbricks_survey") && !!record.source_id;
  const surveySummaryHref = `/workspaces/${workspaceId}/surveys/${record.source_id}/summary`;

  return (
    <tr
      className={`cursor-pointer text-sm text-slate-700 transition-colors focus-within:bg-slate-50 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 ${isSelected ? "bg-slate-50" : ""}`}
      tabIndex={0}
      aria-label={record.field_label ?? record.field_id}
      aria-selected={isSelected}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}>
      {canWrite && (
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
      )}
      <td className="px-4 py-3 text-slate-500" title={collectedAt}>
        <span className="block min-w-0 truncate">{collectedAt}</span>
      </td>
      <td className="px-4 py-3" title={formatSourceType(record.source_type, t)}>
        <Badge
          text={formatSourceType(record.source_type, t)}
          type="gray"
          size="tiny"
          className="inline-block max-w-40 truncate align-middle"
        />
      </td>
      <td className="px-4 py-3" title={record.source_name ?? undefined}>
        {isFormbricksSurveySource ? (
          <Link
            href={surveySummaryHref}
            className="block min-w-0 truncate text-slate-700 underline underline-offset-2 hover:text-slate-900"
            onClick={(event) => event.stopPropagation()}>
            {record.source_name ?? "—"}
          </Link>
        ) : (
          <span className="block min-w-0 truncate">{record.source_name ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3" title={record.field_label ?? undefined}>
        <span className="block min-w-0 truncate">{record.field_label ?? record.field_id}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-slate-600">
          {FIELD_TYPE_ICONS[record.field_type] ?? <HashIcon className="size-3.5" />}
          {formatFieldType(record.field_type)}
        </span>
      </td>
      <td className="px-4 py-3" title={value}>
        <div className="flex min-w-0 items-center gap-1.5">
          {isLongValue ? (
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
      </td>
      <td className="px-4 py-3 text-slate-500" title={record.user_id}>
        {record.user_id && contactId ? (
          <Link
            href={`/workspaces/${workspaceId}/contacts/${contactId}`}
            className="block min-w-0 truncate text-slate-700 underline underline-offset-2 hover:text-slate-900"
            onClick={(event) => event.stopPropagation()}>
            {record.user_id}
          </Link>
        ) : (
          <span className="block min-w-0 truncate">{record.user_id ?? "—"}</span>
        )}
      </td>
    </tr>
  );
};
