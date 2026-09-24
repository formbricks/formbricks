"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { formatLocalDay } from "@/lib/utils/datetime";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { DateRangePicker } from "@/modules/ui/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { useOrganizationUsage } from "../hooks/use-organization-usage";
import {
  DEFAULT_USAGE_RANGE_PRESET,
  type TUsageRangePreset,
  type TUsageRangeQuery,
  USAGE_RANGE_PRESETS,
} from "../lib/range";
import type { TOrganizationUsage, TOrganizationUsageWorkspace } from "../types/usage";

const CUSTOM_VALUE = "custom";

const getPresetLabel = (preset: TUsageRangePreset, t: TFunction): string => {
  switch (preset) {
    case "this_year":
      return t("workspace.analysis.charts.date_preset_this_year");
    case "last_30_days":
      return t("workspace.analysis.charts.date_preset_last_30_days");
    case "all_time":
      return t("workspace.analysis.dashboards.date_filter_all_time");
  }
};

const getWorkspaceColumns = (
  t: TFunction,
  formatCount: (value: number) => string,
  showWorkflowRuns: boolean
): TSettingsTableColumn<TOrganizationUsageWorkspace>[] => {
  const columns: TSettingsTableColumn<TOrganizationUsageWorkspace>[] = [
    {
      id: "workspace",
      header: t("common.workspace"),
      cellClassName: "font-medium text-slate-900",
      cell: (workspace) => workspace.name,
    },
    {
      id: "responses",
      header: t("common.responses"),
      headerClassName: "w-40",
      align: "right",
      cell: (workspace) => formatCount(workspace.responseCount),
    },
  ];

  if (showWorkflowRuns) {
    columns.push({
      id: "workflow-runs",
      header: t("common.workflow_runs"),
      headerClassName: "w-40",
      align: "right",
      cell: (workspace) => formatCount(workspace.workflowRunCount ?? 0),
    });
  }

  return columns;
};

const UsageStat = ({ label, value }: Readonly<{ label: string; value: string }>) => (
  <div className="rounded-lg border border-slate-200 px-4 py-3">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
  </div>
);

const UsageRangeFilter = ({
  value,
  onChange,
  locale,
}: Readonly<{ value: TUsageRangeQuery; onChange: (range: TUsageRangeQuery) => void; locale: string }>) => {
  const { t } = useTranslation();
  const [isCustomMode, setIsCustomMode] = useState(!value.preset);
  const [customRange, setCustomRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });

  const handleSelect = (next: string) => {
    if (next === CUSTOM_VALUE) {
      setIsCustomMode(true);
      return;
    }
    setIsCustomMode(false);
    onChange({ preset: next as TUsageRangePreset });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={isCustomMode ? CUSTOM_VALUE : value.preset} onValueChange={handleSelect}>
        <SelectTrigger className="w-48 bg-white" aria-label={t("workspace.settings.usage.range_label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {USAGE_RANGE_PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {getPresetLabel(preset, t)}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>{t("workspace.analysis.charts.custom_range")}</SelectItem>
        </SelectContent>
      </Select>
      {isCustomMode && (
        <DateRangePicker
          value={{ from: customRange.from ?? undefined, to: customRange.to ?? undefined }}
          locale={locale}
          triggerClassName="w-64"
          onChange={({ from, to }) => {
            setCustomRange({ from, to });
            onChange({ from: formatLocalDay(from), to: formatLocalDay(to) });
          }}
        />
      )}
    </div>
  );
};

const UsageContent = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [range, setRange] = useState<TUsageRangeQuery>({ preset: DEFAULT_USAGE_RANGE_PRESET });
  const { data, isLoading, isError, isFetching } = useOrganizationUsage({ organizationId, range });

  const numberFormat = new Intl.NumberFormat(locale);
  const formatCount = (value: number) => numberFormat.format(value);
  const show = (pick: (usage: TOrganizationUsage) => number) => (data ? formatCount(pick(data)) : "–");
  const showWorkflowRuns =
    data?.totals.workflowRunCount !== null && data?.totals.workflowRunCount !== undefined;

  return (
    <>
      <div className="flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <UsageRangeFilter value={range} onChange={setRange} locale={locale} />
        {data && (
          <p className="text-sm text-slate-500" data-testid="usage-time-zone">
            {t("workspace.settings.usage.time_zone_note", { timeZone: data.timeZone })}
          </p>
        )}
      </div>

      {isError && (
        <Alert variant="error" className="mt-4 max-w-4xl">
          <AlertDescription>{t("workspace.settings.usage.load_error")}</AlertDescription>
        </Alert>
      )}

      <SettingsCard
        title={t("workspace.settings.usage.responses_title")}
        description={t("workspace.settings.usage.responses_description")}
        bodyVariant="flush">
        <SettingsTable
          aria-label={t("workspace.settings.usage.responses_title")}
          data-testid="usage-workspaces-table"
          columns={getWorkspaceColumns(t, formatCount, showWorkflowRuns)}
          rows={data?.workspaces ?? []}
          getRowId={(workspace) => workspace.id}
          emptyMessage={t("workspace.settings.usage.no_workspaces")}
          isLoading={isLoading}
          className={isFetching && !isLoading ? "opacity-60" : undefined}
          footer={
            data && data.workspaces.length > 0 ? (
              <div
                className="flex border-t border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900"
                data-testid="usage-total-row">
                <span className="flex-1">{t("workspace.settings.usage.total")}</span>
                <span className="w-40 text-right tabular-nums">{formatCount(data.totals.responseCount)}</span>
                {showWorkflowRuns && (
                  <span className="w-40 text-right tabular-nums">
                    {formatCount(data.totals.workflowRunCount ?? 0)}
                  </span>
                )}
              </div>
            ) : undefined
          }
        />
      </SettingsCard>

      <SettingsCard
        title={t("common.surveys")}
        description={t("workspace.settings.usage.surveys_description")}>
        <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3">
          <UsageStat label={t("common.in_progress")} value={show((usage) => usage.surveys.inProgress)} />
          <UsageStat label={t("common.scheduled")} value={show((usage) => usage.surveys.scheduled)} />
          <UsageStat label={t("common.paused")} value={show((usage) => usage.surveys.paused)} />
          <UsageStat label={t("common.completed")} value={show((usage) => usage.surveys.completed)} />
          <UsageStat label={t("common.draft")} value={show((usage) => usage.surveys.draft)} />
          <UsageStat label={t("common.archived")} value={show((usage) => usage.surveys.archived)} />
        </div>
      </SettingsCard>

      <SettingsCard
        title={t("common.members")}
        description={t("workspace.settings.usage.members_description")}>
        <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-4">
          <UsageStat
            label={t("workspace.settings.usage.members_total")}
            value={show((usage) => usage.members.total)}
          />
          <UsageStat
            label={t("workspace.settings.usage.members_active")}
            value={show((usage) => usage.members.active)}
          />
          <UsageStat
            label={t("workspace.settings.usage.members_dormant")}
            value={show((usage) => usage.members.dormant)}
          />
          <UsageStat
            label={t("workspace.settings.usage.members_deactivated")}
            value={show((usage) => usage.members.deactivated)}
          />
        </div>
      </SettingsCard>
    </>
  );
};

export const UsageView = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <UsageContent organizationId={organizationId} />
    </QueryClientProvider>
  );
};
