"use client";

import { ChartColumnIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { StatCard } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/components/stat-card";
import { cn } from "@/lib/cn";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/modules/ui/components/chart";
import { OTHER_PAGE } from "../../lib/stats";
import { formatClickRate, formatCount, toDailyChartRows } from "../../lib/summary";
import type { TCreativeStats } from "../../lib/summary-api";
import { getUiLocale } from "../../lib/ui-locale";

const SECTION = "rounded-xl border border-slate-200 bg-white shadow-xs";

/** Impressions, Clicks and Click rate for the range, the daily chart and the by-page table. */
export const CreativeSummaryStats = ({
  stats,
  isUpdating,
}: Readonly<{ stats: TCreativeStats; isUpdating: boolean }>) => {
  const { t, i18n } = useTranslation();
  const locale = getUiLocale(i18n);
  const { totals, days, pages = [] } = stats;
  const hasCounts = totals.impressions > 0 || totals.clicks > 0;

  const chartConfig: ChartConfig = {
    impressions: { label: t("common.impressions"), color: "var(--color-slate-300)" },
    clicks: { label: t("common.clicks"), color: "var(--color-slate-800)" },
  };

  return (
    // A new range keeps the last counts on screen, dimmed, until its own arrive.
    <div aria-busy={isUpdating} className={cn("space-y-6 transition-opacity", isUpdating && "opacity-60")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t("common.impressions")}
          value={formatCount(totals.impressions, locale)}
          tooltipText={t("workspace.creatives.summary.impressions_tooltip")}
        />
        <StatCard
          label={t("common.clicks")}
          value={formatCount(totals.clicks, locale)}
          tooltipText={t("workspace.creatives.summary.clicks_tooltip")}
        />
        <StatCard
          label={t("workspace.creatives.summary.click_rate")}
          value={formatClickRate(totals.clickRate, locale)}
          tooltipText={t("workspace.creatives.summary.click_rate_hint")}
        />
      </div>

      {hasCounts ? (
        <>
          <section className={cn(SECTION, "p-5")}>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              {t("workspace.creatives.summary.daily_totals")}
            </h2>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={toDailyChartRows(days, locale)} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                {/* Every Nth day from the first, with N as small as the labels allow: evenly spaced, so
                    no day reads as missing. */}
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                  interval="equidistantPreserveStart"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                  tickFormatter={(value: number) => formatCount(value, locale)}
                />
                <ChartTooltip cursor={{ fill: "var(--color-slate-100)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="impressions" fill="var(--color-impressions)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </section>

          <section className={SECTION}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("workspace.creatives.summary.top_pages")}
              </h2>
              <p className="text-xs text-slate-500">{t("workspace.creatives.summary.pages_hint")}</p>
            </div>
            <div className="max-h-[28rem] overflow-auto px-5 pb-3">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs whitespace-nowrap text-slate-500">
                    <th className="pb-2 font-medium">{t("workspace.creatives.summary.page")}</th>
                    <th className="pb-2 pl-4 text-right font-medium">{t("common.impressions")}</th>
                    <th className="pb-2 pl-4 text-right font-medium">{t("common.clicks")}</th>
                    <th className="pb-2 pl-4 text-right font-medium">
                      {t("workspace.creatives.summary.click_rate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.page} className="border-t border-slate-100">
                      {/* `w-full max-w-0` lets a long page truncate instead of widening the table. */}
                      {page.page === OTHER_PAGE ? (
                        <td className="w-full max-w-0 truncate py-2.5 text-slate-500 italic">
                          {t("workspace.creatives.summary.other_pages")}
                        </td>
                      ) : (
                        <td
                          className="w-full max-w-0 truncate py-2.5 font-medium text-slate-800"
                          title={page.page}>
                          {page.page}
                        </td>
                      )}
                      <td className="py-2.5 pl-4 text-right text-slate-600 tabular-nums">
                        {formatCount(page.impressions, locale)}
                      </td>
                      <td className="py-2.5 pl-4 text-right text-slate-600 tabular-nums">
                        {formatCount(page.clicks, locale)}
                      </td>
                      <td className="py-2.5 pl-4 text-right text-slate-600 tabular-nums">
                        {formatClickRate(page.clickRate, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
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
    </div>
  );
};
