"use client";

import { useTranslation } from "react-i18next";
import {
  type TDistributionEntry,
  buildDistributionSegments,
  formatCellValue,
  getSemanticDimensionColor,
  getSentimentMeasureColor,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  getMeasureAxisLabel,
  sortMeasureIdsForCategoryAxis,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

const formatPercent = (percent: number): string => `${Math.round(percent * 100)}%`;

interface BreakdownBarsProps {
  /** Rows already sorted into the dimension's display order (sentiment scale for sentiment). */
  sortedData: TChartDataRow[];
  dataKeys: string[];
  dataKey: string;
  hasCategoryAxis: boolean;
  xAxisKey: string;
  formatDimensionValue: (value: unknown) => string;
}

/**
 * A pie chart's other rendering: one horizontal bar split into a section per group, sized by each
 * group's share of the total, with the count and share on hover. Chosen through the pie chart's
 * "Breakdown bars" display setting.
 *
 * The same data a pie shows, in a fraction of the height — which is what makes it worth having for
 * a single distribution like sentiment, where a pie spends a lot of vertical space on six slices.
 * Sections take the sentiment scale colours when the query reads sentiment, and a measure-only
 * query turns each measure into a section.
 */
export function BreakdownBars({
  sortedData,
  dataKeys,
  dataKey,
  hasCategoryAxis,
  xAxisKey,
  formatDimensionValue,
}: Readonly<BreakdownBarsProps>) {
  const { t } = useTranslation();

  let entries: TDistributionEntry[];
  if (hasCategoryAxis) {
    // Grouped query: one section per row, the first measure supplying the size.
    entries = sortedData.map((row, index) => ({
      key: `${String(row[xAxisKey] ?? "")}-${index}`,
      label: formatDimensionValue(row[xAxisKey]),
      value: row[dataKey],
      color: getSemanticDimensionColor(xAxisKey, row[xAxisKey]),
    }));
  } else {
    // Measure-only query: each measure is its own section. Sentiment counts take the sentiment
    // scale order so the bar reads in the same direction as a sentiment-grouped one.
    entries = sortMeasureIdsForCategoryAxis(dataKeys).map((key) => ({
      key,
      label: getMeasureAxisLabel(key, t),
      value: sortedData.reduce((sum, row) => sum + (Number(row[key]) || 0), 0),
      color: getSentimentMeasureColor(key),
    }));
  }

  const result = buildDistributionSegments(entries);
  if (!result) {
    return (
      <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center">
        {t("workspace.analysis.charts.no_valid_data_to_display")}
      </div>
    );
  }

  // Formatted once per section and shared by the bar and the legend. The `value (share)` and
  // `label: value (share)` templates are translated, so a locale controls its own punctuation and
  // the order of the two numbers.
  const formattedSegments = result.segments.map((segment) => {
    const value = formatCellValue(segment.value);
    const percent = formatPercent(segment.percent);
    return {
      ...segment,
      valueShare: t("workspace.analysis.charts.distribution_value_share", { value, percent }),
      ariaLabel: t("workspace.analysis.charts.distribution_segment_label", {
        label: segment.label,
        value,
        percent,
      }),
    };
  });

  return (
    <div className="flex h-full min-h-64 w-full min-w-0 flex-col justify-center px-2 py-4">
      <TooltipProvider delayDuration={0}>
        {/* The sections carry no text of their own: a label wide enough for the widest section is
            still clipped on the narrow ones, at which point it reads as noise rather than data.
            The legend below names every section instead, at a size that does not depend on how
            the shares happen to fall. */}
        <div className="flex w-full gap-0.5">
          {formattedSegments.map((segment) => (
            <Tooltip key={segment.key}>
              {/* The section is the tooltip's trigger, so it is a real button rather than a
                  focusable div: keyboard users reach it natively and its label is announced as
                  the control it is. Shrink (never grow) so the gaps come out of the sections
                  proportionally and the widths stay a faithful read of each share. */}
              <TooltipTrigger
                className="h-8 min-w-[3px] shrink grow-0 cursor-default rounded-sm focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-1 focus-visible:outline-hidden"
                style={{ flexBasis: `${segment.percent * 100}%`, backgroundColor: segment.color }}
                aria-label={segment.ariaLabel}
              />
              <TooltipContent>
                <div className="flex items-center gap-2">
                  <div
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-foreground text-sm font-medium">{segment.label}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">{segment.valueShare}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      {/* Every section named, in bar order. */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {formattedSegments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="text-foreground">{segment.label}</span>
            <span className="text-muted-foreground tabular-nums">{segment.valueShare}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
