import { useRef } from "react";
import { Legend } from "./Legend";
import { Tooltip } from "./Tooltip";
import { type FormatContext, formatTick } from "./format";
import {
  barShapePath,
  chooseBarOrientation,
  estimateTextWidth,
  labelFits,
  layoutBands,
  seriesAtOffset,
  truncateLabel,
  wrapLabel,
} from "./layout";
import { seriesColorVar } from "./palette";
import { linearScale, resolveYAxis } from "./scale";
import type { CartesianData } from "./series";
import { announce, buildCartesianTooltip } from "./tooltip";
import type { Selection } from "./tooltip";
import { useChartInteraction } from "./use-chart-interaction";

interface BarChartProps {
  data: CartesianData;
  title: string;
  width: number;
  context: FormatContext;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

const TOP = 12;
const BOTTOM_VERTICAL = 30;
const BOTTOM_HORIZONTAL = 26;
const RIGHT = 12;
const MAX_VALUE_LABELS = 12;

export const BarChart = ({ data, title, width, context, selection, onSelect }: Readonly<BarChartProps>) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { categories, series } = data;
  const seriesCount = series.length;

  const values = series.flatMap((entry) => entry.values).filter((value): value is number => value !== null);
  const labels = categories.map((category) => category.label);

  // The value axis first: its tick labels decide how much room the left edge needs.
  const probe = resolveYAxis({ values, fixed: data.fixedDomain, target: 5 });
  const tickTexts = probe.ticks.map((tick) => formatTick(tick, probe.step, context.locale));
  const valueAxisWidth = Math.max(...tickTexts.map((text) => estimateTextWidth(text, 11))) + 12;
  const orientation = chooseBarOrientation(labels, width - valueAxisWidth - RIGHT);
  const vertical = orientation === "vertical";

  const categoryLabelWidth = Math.min(
    Math.max(...labels.map((label) => estimateTextWidth(label, 11))),
    Math.floor(width * 0.42),
    230
  );
  const left = vertical ? valueAxisWidth : categoryLabelWidth + 12;
  const plotWidth = Math.max(40, width - left - RIGHT);

  const axis = resolveYAxis({
    values,
    fixed: data.fixedDomain,
    target: vertical ? 5 : Math.min(6, Math.max(2, Math.floor(plotWidth / 70))),
  });

  const bandSize = vertical ? 0 : Math.max(28, seriesCount * 14 + 12);
  const plotHeight = vertical ? (width < 420 ? 190 : 230) : categories.length * bandSize;
  const height = TOP + plotHeight + (vertical ? BOTTOM_VERTICAL : BOTTOM_HORIZONTAL);

  const layout = layoutBands(vertical ? plotWidth : plotHeight, categories.length, seriesCount);
  const scale = linearScale([axis.min, axis.max], vertical ? [plotHeight, 0] : [0, plotWidth]);
  const zero = scale(0);

  const { active, setActive, handlers } = useChartInteraction({
    categoryCount: categories.length,
    seriesCount,
    categoryKeys: vertical ? "horizontal" : "vertical",
    onSelect,
  });

  const bar = (category: number, seriesIndex: number) => {
    const value = series[seriesIndex].values.at(category);
    if (value === null || value === undefined) return undefined;
    const end = scale(value);
    const along = (vertical ? left : TOP) + category * layout.band + layout.offsets[seriesIndex];
    if (vertical) {
      const y = TOP + Math.min(end, zero);
      const h = Math.abs(end - zero);
      return {
        value,
        x: along,
        y,
        width: layout.thickness,
        height: h,
        direction: value >= 0 ? "up" : "down",
        tip: TOP + end,
      } as const;
    }
    const x = left + Math.min(end, zero);
    const w = Math.abs(end - zero);
    return {
      value,
      x,
      y: along,
      width: w,
      height: layout.thickness,
      direction: value >= 0 ? "right" : "left",
      tip: left + end,
    } as const;
  };

  const anchorFor = (position: Selection) => {
    const shape = bar(position.category, position.series);
    const centre = (vertical ? left : TOP) + position.category * layout.band + layout.band / 2;
    if (vertical) return { x: centre, y: shape ? shape.tip : TOP + zero };
    return { x: shape ? shape.tip : left + zero, y: centre };
  };

  const seriesAtPointer = (event: { clientX: number; clientY: number }, category: number): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || seriesCount < 2) return 0;
    const offset = vertical
      ? event.clientX - rect.left - left - category * layout.band
      : event.clientY - rect.top - TOP - category * layout.band;
    return seriesAtOffset(layout, offset);
  };

  const tooltip = active ? buildCartesianTooltip(data, active, context) : undefined;
  const showValueLabels = seriesCount === 1 && categories.length <= MAX_VALUE_LABELS;

  return (
    <div className="fbc-stack-tight">
      <Legend series={series} mark="square" />
      <div className="fbc-plot">
        <svg
          ref={svgRef}
          className="fbc-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-roledescription="bar chart"
          aria-label={`${title}. ${categories.length} categories. Use the arrow keys to move between values and Enter to select one. The table view lists every value.`}
          tabIndex={0}
          {...handlers}
          onPointerLeave={() => setActive(null)}>
          {axis.ticks.map((tick) => {
            const at = scale(tick);
            const text = formatTick(tick, axis.step, context.locale);
            return vertical ? (
              <g key={tick}>
                <line className="fbc-grid" x1={left} x2={left + plotWidth} y1={TOP + at} y2={TOP + at} />
                <text className="fbc-tick" x={left - 8} y={TOP + at + 4} textAnchor="end">
                  {text}
                </text>
              </g>
            ) : (
              <g key={tick}>
                <line className="fbc-grid" x1={left + at} x2={left + at} y1={TOP} y2={TOP + plotHeight} />
                <text className="fbc-tick" x={left + at} y={TOP + plotHeight + 16} textAnchor="middle">
                  {text}
                </text>
              </g>
            );
          })}

          {vertical ? (
            <line className="fbc-axis" x1={left} x2={left + plotWidth} y1={TOP + zero} y2={TOP + zero} />
          ) : (
            <line className="fbc-axis" x1={left + zero} x2={left + zero} y1={TOP} y2={TOP + plotHeight} />
          )}

          {categories.map((category, c) => {
            const start = (vertical ? left : TOP) + c * layout.band;
            const isActive = active?.category === c;
            const isSelected = selection?.category === c;
            const labelRoom = vertical ? layout.band - 8 : categoryLabelWidth;
            return (
              <g key={category.id}>
                {isActive || isSelected ? (
                  <rect
                    className={isSelected ? "fbc-band-active fbc-band-selected" : "fbc-band-active"}
                    x={vertical ? start : left}
                    y={vertical ? TOP : start}
                    width={vertical ? layout.band : plotWidth}
                    height={vertical ? plotHeight : layout.band}
                  />
                ) : null}
                {vertical ? (
                  <text
                    className="fbc-tick"
                    x={start + layout.band / 2}
                    y={TOP + plotHeight + 18}
                    textAnchor="middle">
                    {truncateLabel(category.label, labelRoom, 11)}
                  </text>
                ) : (
                  <text className="fbc-tick" x={left - 8} textAnchor="end">
                    {wrapLabel(category.label, labelRoom, 2, 11).map((line, index, lines) => (
                      <tspan
                        key={index}
                        x={left - 8}
                        y={start + layout.band / 2 + 4 + (index - (lines.length - 1) / 2) * 12}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            );
          })}

          {categories.map((category, c) =>
            series.map((entry, s) => {
              const shape = bar(c, s);
              if (!shape || (shape.width < 0.5 && shape.height < 0.5)) return null;
              const dim = active !== null && active.category !== c;
              return (
                <path
                  key={`${category.id}-${entry.id}`}
                  className={dim ? "fbc-bar fbc-bar-dim" : "fbc-bar"}
                  d={barShapePath(shape.x, shape.y, shape.width, shape.height, shape.direction)}
                  fill={seriesColorVar(entry.colorIndex)}
                />
              );
            })
          )}

          {showValueLabels
            ? categories.map((category, c) => {
                const shape = bar(c, 0);
                if (!shape) return null;
                const text = formatTick(shape.value, axis.step, context.locale);
                const textWidth = estimateTextWidth(text, 11);
                if (vertical) {
                  if (!labelFits(textWidth, layout.band, 2)) return null;
                  const above = shape.value >= 0;
                  return (
                    <text
                      key={category.id}
                      className="fbc-value"
                      x={shape.x + shape.width / 2}
                      y={above ? shape.y - 5 : shape.y + shape.height + 13}
                      textAnchor="middle">
                      {text}
                    </text>
                  );
                }
                const room = shape.value >= 0 ? left + plotWidth - shape.tip : shape.tip - left;
                if (room < textWidth + 10) return null;
                return (
                  <text
                    key={category.id}
                    className="fbc-value"
                    x={shape.value >= 0 ? shape.tip + 6 : shape.tip - 6}
                    y={shape.y + shape.height / 2 + 4}
                    textAnchor={shape.value >= 0 ? "start" : "end"}>
                    {text}
                  </text>
                );
              })
            : null}

          {categories.map((category, c) => (
            <rect
              key={`hit-${category.id}`}
              className="fbc-band-hit"
              x={vertical ? left + c * layout.band : left}
              y={vertical ? TOP : TOP + c * layout.band}
              width={vertical ? layout.band : plotWidth}
              height={vertical ? plotHeight : layout.band}
              onPointerMove={(event) => setActive({ category: c, series: seriesAtPointer(event, c) })}
              onClick={(event) => {
                svgRef.current?.focus({ preventScroll: true });
                onSelect({ category: c, series: seriesAtPointer(event, c) });
              }}
            />
          ))}
        </svg>
        {tooltip && active ? (
          <Tooltip content={tooltip} anchor={anchorFor(active)} containerWidth={width} />
        ) : null}
        <span className="fb-sr-only" aria-live="polite">
          {announce(tooltip)}
        </span>
      </div>
    </div>
  );
};
