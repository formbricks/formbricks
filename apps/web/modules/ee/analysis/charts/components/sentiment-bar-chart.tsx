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

/**
 * Below this share a section is too narrow to hold its inline label without the text being clipped
 * to noise, so the label is dropped and the section is identified on hover/focus instead.
 */
const SEGMENT_LABEL_MIN_PERCENT = 0.12;

const formatPercent = (percent: number): string => `${Math.round(percent * 100)}%`;

interface SentimentBarChartProps {
  /** Rows already sorted into the dimension's display order (sentiment scale for sentiment). */
  sortedData: TChartDataRow[];
  dataKeys: string[];
  dataKey: string;
  hasCategoryAxis: boolean;
  xAxisKey: string;
  formatDimensionValue: (value: unknown) => string;
}

/**
 * The "Sentiment" chart type: one horizontal bar split into a section per group, sized by each
 * group's share of the total, with the count and share on hover.
 *
 * Built for sentiment (picking the type pre-populates response count grouped by sentiment, so the
 * sections arrive colored on the sentiment scale) but not limited to it — any single-measure
 * grouped query renders as a distribution, and a measure-only query turns each measure into a
 * section, which is what the six sentiment count measures need.
 */
export function SentimentBarChart({
  sortedData,
  dataKeys,
  dataKey,
  hasCategoryAxis,
  xAxisKey,
  formatDimensionValue,
}: Readonly<SentimentBarChartProps>) {
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

  const { segments } = result;

  return (
    <div className="flex h-full min-h-64 w-full min-w-0 flex-col justify-center px-2 py-4">
      <TooltipProvider delayDuration={0}>
        <div className="flex w-full items-end gap-0.5">
          {segments.map((segment) => {
            const percentText = formatPercent(segment.percent);
            const valueText = formatCellValue(segment.value);
            return (
              <div
                key={segment.key}
                // Shrink (never grow) so the gaps come out of the sections proportionally and the
                // widths stay a faithful read of each share.
                className="min-w-[3px] shrink grow-0"
                style={{ flexBasis: `${segment.percent * 100}%` }}>
                <div className="text-muted-foreground mb-1.5 h-4 truncate text-center text-xs">
                  {segment.percent >= SEGMENT_LABEL_MIN_PERCENT
                    ? `${segment.label} ${percentText} (${valueText})`
                    : ""}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="h-8 w-full rounded-sm focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-1 focus-visible:outline-hidden"
                      style={{ backgroundColor: segment.color }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${segment.label}: ${valueText} (${percentText})`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="text-foreground text-sm font-medium">{segment.label}</span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {valueText} ({percentText})
                      </span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </TooltipProvider>
      {/* Every section named, in bar order — the sections too narrow for an inline label are
          otherwise only identifiable by hovering them. */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="text-foreground">{segment.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatPercent(segment.percent)} ({formatCellValue(segment.value)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
