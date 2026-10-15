"use client";

import {
  ArrowLeftIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  ClockIcon,
  LinkIcon,
  MessageCircleIcon,
  PencilIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { Button } from "@/modules/ui/components/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/modules/ui/components/chart";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getCreativeEditPath, getCreativesPath } from "../../lib/paths";
import { getMockDisplayState, getMockLinkedSurvey } from "../../mock/data";
import type { TCreative } from "../../types";
import { CREATIVE_TYPE_ICONS } from "../creative-icons";
import { CreativeStatusBadge } from "../creative-status-badge";
import { Segmented } from "../editor/editor-primitives";
import { MockDataBadge } from "../mock-data-badge";

type TRange = "7" | "30";

const KpiCard = ({ label, value, hint }: Readonly<{ label: string; value: string; hint?: string }>) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
);

export const CreativeSummary = ({
  workspaceId,
  creative,
}: Readonly<{ workspaceId: string; creative: TCreative }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [now] = useState(() => new Date());
  const [range, setRange] = useState<TRange>("30");
  const state = getMockDisplayState(creative, now);
  const survey = getMockLinkedSurvey(creative);
  const TypeIconComponent = CREATIVE_TYPE_ICONS[creative.type];

  const numberFormat = new Intl.NumberFormat(locale);
  const percentFormat = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const daily = creative.daily.slice(-Number(range));
  const impressions = daily.reduce((sum, day) => sum + day.impressions, 0);
  const clicks = daily.reduce((sum, day) => sum + day.clicks, 0);
  const chartData = daily.map((day) => ({
    day: formatDateForDisplay(day.day, locale, { month: "short", day: "numeric" }),
    impressions: day.impressions,
    clicks: day.clicks,
  }));
  const chartConfig: ChartConfig = {
    impressions: { label: t("common.impressions"), color: "var(--color-slate-300)" },
    clicks: { label: t("common.clicks"), color: "var(--color-slate-800)" },
  };
  const hasData = daily.length > 0;

  return (
    <PageContentWrapper>
      <Link
        href={getCreativesPath(workspaceId)}
        className="-mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeftIcon className="size-4" />
        {t("common.creatives")}
      </Link>
      <PageHeader
        pageTitle={
          <span className="flex items-center gap-3">
            {creative.name}
            <CreativeStatusBadge state={state} className="text-sm" />
          </span>
        }
        cta={
          <div className="flex items-center gap-2">
            <MockDataBadge />
            <Button variant="secondary" size="sm" asChild>
              <Link href={getCreativeEditPath(workspaceId, creative.id)}>
                <PencilIcon />
                {t("common.edit")}
              </Link>
            </Button>
          </div>
        }>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <TypeIconComponent className="size-4 text-slate-400" aria-hidden="true" />
            {creative.type === "banner"
              ? t("workspace.creatives.type_banner")
              : t("workspace.creatives.type_feedback_button")}
          </span>
          {survey && (
            <span className="inline-flex items-center gap-1.5">
              <MessageCircleIcon className="size-4 text-slate-400" aria-hidden="true" />
              {t("workspace.creatives.summary.opens_survey", { name: survey.name })}
            </span>
          )}
          {creative.action.kind === "link" && creative.action.url && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <LinkIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{creative.action.url}</span>
            </span>
          )}
          {(creative.startsAt || creative.endsAt) && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClockIcon className="size-4 text-slate-400" aria-hidden="true" />
              {[creative.startsAt, creative.endsAt]
                .map((date) =>
                  date
                    ? formatDateTimeForDisplay(date, locale, { dateStyle: "medium", timeStyle: "short" })
                    : "…"
                )
                .join(" – ")}
            </span>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel={t("workspace.creatives.summary.range")}
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: t("workspace.creatives.summary.last_days", { days: 7 }) },
            { value: "30", label: t("workspace.creatives.summary.last_days", { days: 30 }) },
          ]}
        />
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <ClockIcon className="size-3.5" aria-hidden="true" />
          {t("workspace.creatives.summary.freshness")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("common.impressions")} value={numberFormat.format(impressions)} />
        <KpiCard label={t("common.clicks")} value={numberFormat.format(clicks)} />
        <KpiCard
          label={t("workspace.creatives.summary.click_rate")}
          value={impressions ? percentFormat.format(clicks / impressions) : "—"}
          hint={t("workspace.creatives.summary.click_rate_hint")}
        />
      </div>

      {hasData ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              {t("workspace.creatives.summary.daily_totals")}
            </h2>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value) => numberFormat.format(value)}
                />
                <ChartTooltip cursor={{ fill: "var(--color-slate-100)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="impressions" fill="var(--color-impressions)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              {t("workspace.creatives.summary.top_pages")}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">{t("workspace.creatives.summary.page")}</th>
                  <th className="pb-2 text-right font-medium">{t("common.impressions")}</th>
                  <th className="pb-2 text-right font-medium">
                    {t("workspace.creatives.summary.click_rate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {creative.pages.map((page) => (
                  <tr key={page.path} className="border-t border-slate-100">
                    <td className="py-2.5 font-medium text-slate-800">{page.path}</td>
                    <td className="py-2.5 text-right text-slate-600 tabular-nums">
                      {numberFormat.format(page.impressions)}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 tabular-nums">
                      {percentFormat.format(page.clicks / page.impressions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <ChartColumnIcon className="size-6 text-slate-400" strokeWidth={1.5} />
          <p className="text-sm font-medium text-slate-700">
            {t("workspace.creatives.summary.no_data_title")}
          </p>
          <p className="max-w-sm text-sm text-slate-500">
            {t("workspace.creatives.summary.no_data_description")}
          </p>
        </div>
      )}
    </PageContentWrapper>
  );
};
