"use client";

import {
  CalendarIcon,
  HashIcon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  ToggleLeftIcon,
  TypeIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { listFeedbackRecordsAction } from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

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

function formatValue(record: FeedbackRecordData): string {
  if (record.value_text != null) return record.value_text;
  if (record.value_number != null) return String(record.value_number);
  if (record.value_boolean != null) return record.value_boolean ? "Yes" : "No";
  if (record.value_date != null) return new Date(record.value_date).toLocaleDateString();
  return "—";
}

function formatDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

interface FeedbackRecordsTableProps {
  environmentId: string;
  initialRecords: FeedbackRecordData[];
  initialTotal: number;
}

export function FeedbackRecordsTable({
  environmentId,
  initialRecords,
  initialTotal,
}: FeedbackRecordsTableProps) {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<FeedbackRecordData[]>(initialRecords);
  const [total, setTotal] = useState(initialTotal);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(
    async (offset: number, append: boolean) => {
      const setLoading = offset === 0 ? setIsRefreshing : setIsLoadingMore;
      setLoading(true);
      setError(null);

      const result = await listFeedbackRecordsAction({
        environmentId,
        limit: RECORDS_PER_PAGE,
        offset,
      });

      if (!result?.data) {
        setError(getFormattedErrorMessage(result) ?? t("environments.unify.failed_to_load_feedback_records"));
        setLoading(false);
        return;
      }

      const response = result.data;
      setRecords((prev) => (append ? [...prev, ...response.data] : response.data));
      setTotal(response.total);
      setLoading(false);
    },
    [environmentId, t]
  );

  const handleLoadMore = () => {
    fetchRecords(records.length, true);
  };

  const handleRefresh = () => {
    fetchRecords(0, false);
  };

  const hasMore = records.length < total;

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

  if (records.length === 0 && !isRefreshing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex h-48 flex-col items-center justify-center gap-2 px-4 text-center">
          <MessageSquareTextIcon className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">{t("environments.unify.no_feedback_records")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {t("environments.unify.showing_count", { count: records.length, total })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={isRefreshing}
          className="gap-1.5">
          <RefreshCwIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.collected_at")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.source_type")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.source_name")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.field_label")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.field_type")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.value")}</th>
                <th className="whitespace-nowrap px-4 py-3">{t("environments.unify.user_identifier")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <FeedbackRecordRow key={record.id} record={record} locale={i18n.language} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={handleLoadMore} loading={isLoadingMore}>
            {t("environments.unify.load_more")}
          </Button>
        </div>
      )}
    </div>
  );
}

function FeedbackRecordRow({ record, locale }: { record: FeedbackRecordData; locale: string }) {
  const value = formatValue(record);
  const isLongValue = value.length > 60;

  return (
    <tr className="text-sm text-slate-700 transition-colors hover:bg-slate-50">
      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
        {formatDate(record.collected_at, locale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge text={record.source_type} type="gray" size="tiny" />
      </td>
      <td className="max-w-[150px] truncate px-4 py-3" title={record.source_name ?? undefined}>
        {record.source_name ?? "—"}
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
      <td className="max-w-[120px] truncate px-4 py-3 text-slate-500" title={record.user_identifier}>
        {record.user_identifier ?? "—"}
      </td>
    </tr>
  );
}
