import { useRef } from "react";
import { Legend } from "./Legend";
import { Tooltip } from "./Tooltip";
import { type FormatContext, formatTick } from "./format";
import { estimateTextWidth, placeEndLabels, selectTickIndices, truncateLabel } from "./layout";
import { seriesColorVar } from "./palette";
import { linearScale, nearestIndex, resolveYAxis } from "./scale";
import type { CartesianData } from "./series";
import { announce, buildCartesianTooltip } from "./tooltip";
import type { Selection } from "./tooltip";
import { useChartInteraction } from "./use-chart-interaction";

interface LineChartProps {
  data: CartesianData;
  title: string;
  kind: "line" | "area";
  width: number;
  context: FormatContext;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

const TOP = 12;
const BOTTOM = 30;
const INSET = 10;
const END_LABEL_MIN_WIDTH = 480;
const END_LABEL_MAX_SERIES = 4;
const END_LABEL_ROOM = 96;

interface Point {
  x: number;
  y: number;
}

/** Runs of consecutive values: a missing value breaks the line, it is not drawn as zero. */
const segmentsOf = (points: (Point | null)[]): Point[][] => {
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (const point of points) {
    if (point) {
      current.push(point);
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
};

const linePath = (segment: Point[]): string =>
  segment
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

const areaPath = (segment: Point[], baseline: number): string =>
  `${linePath(segment)} L${segment[segment.length - 1].x.toFixed(1)},${baseline.toFixed(1)} L${segment[0].x.toFixed(1)},${baseline.toFixed(1)} Z`;

export const LineChart = ({
  data,
  title,
  kind,
  width,
  context,
  selection,
  onSelect,
}: Readonly<LineChartProps>) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { categories, series } = data;
  const count = categories.length;

  const values = series.flatMap((entry) => entry.values).filter((value): value is number => value !== null);
  const probe = resolveYAxis({ values, fixed: data.fixedDomain });
  const tickTexts = probe.ticks.map((tick) => formatTick(tick, probe.step, context.locale));
  const left = Math.max(...tickTexts.map((text) => estimateTextWidth(text, 11))) + 14;

  const showEndLabels =
    series.length >= 2 && series.length <= END_LABEL_MAX_SERIES && width >= END_LABEL_MIN_WIDTH;
  const right = 12 + (showEndLabels ? END_LABEL_ROOM : 0);
  const plotWidth = Math.max(40, width - left - right);
  const plotHeight = width < 420 ? 190 : 230;
  const height = TOP + plotHeight + BOTTOM;

  const axis = resolveYAxis({ values, fixed: data.fixedDomain, target: 5 });
  const y = linearScale([axis.min, axis.max], [TOP + plotHeight, TOP]);

  const times = categories.flatMap((category) => (category.ms === undefined ? [] : [category.ms]));
  const useTime = data.isTime && times.length === count && count > 1;
  const xs = categories.map((_, index) => {
    if (count === 1) return left + plotWidth / 2;
    if (useTime) {
      return left + linearScale([times[0], times[count - 1]], [INSET, plotWidth - INSET])(times[index]);
    }
    return left + INSET + (index * (plotWidth - INSET * 2)) / (count - 1);
  });

  const { active, setActive, handlers } = useChartInteraction({
    categoryCount: count,
    seriesCount: series.length,
    categoryKeys: "horizontal",
    onSelect,
  });

  const pointsOf = (seriesIndex: number): (Point | null)[] =>
    series[seriesIndex].values.map((value, index) => (value === null ? null : { x: xs[index], y: y(value) }));

  const tickIndices = selectTickIndices(count, Math.max(2, Math.floor(plotWidth / 72)));
  const baseline = y(Math.max(axis.min, Math.min(0, axis.max)));

  const pointerPosition = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : undefined;
  };

  const seriesNearest = (category: number, py: number): number => {
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    series.forEach((entry, index) => {
      const value = entry.values.at(category);
      if (value === null || value === undefined) return;
      const distance = Math.abs(y(value) - py);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };

  const locate = (event: { clientX: number; clientY: number }): Selection | undefined => {
    const position = pointerPosition(event);
    if (!position) return undefined;
    const category = nearestIndex(xs, position.x);
    return category < 0 ? undefined : { category, series: seriesNearest(category, position.y) };
  };

  const tooltip = active ? buildCartesianTooltip(data, active, context) : undefined;
  const activeValue = active ? series.at(active.series)?.values.at(active.category) : undefined;
  const anchor = active
    ? { x: xs[active.category], y: typeof activeValue === "number" ? y(activeValue) : TOP + plotHeight / 2 }
    : undefined;

  const endLabels = showEndLabels
    ? placeEndLabels(
        series.flatMap((entry, index) => {
          const last = [...pointsOf(index)].reverse().find((point): point is Point => point !== null);
          return last ? [{ id: entry.id, y: last.y }] : [];
        })
      )
    : new Set<string>();

  return (
    <div className="fbc-stack-tight">
      <Legend series={series} mark="line" />
      <div className="fbc-plot">
        <svg
          ref={svgRef}
          className="fbc-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-roledescription={kind === "area" ? "area chart" : "line chart"}
          aria-label={`${title}. ${count} points. Use the arrow keys to move between points and Enter to select one. The table view lists every value.`}
          tabIndex={0}
          {...handlers}
          onPointerLeave={() => setActive(null)}>
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line className="fbc-grid" x1={left} x2={left + plotWidth} y1={y(tick)} y2={y(tick)} />
              <text className="fbc-tick" x={left - 8} y={y(tick) + 4} textAnchor="end">
                {formatTick(tick, axis.step, context.locale)}
              </text>
            </g>
          ))}
          <line className="fbc-axis" x1={left} x2={left + plotWidth} y1={baseline} y2={baseline} />

          {tickIndices.map((index) => (
            <text
              key={categories[index].id}
              className="fbc-tick"
              x={xs[index]}
              y={TOP + plotHeight + 18}
              textAnchor="middle">
              {truncateLabel(
                categories[index].label,
                Math.max(40, plotWidth / Math.max(1, tickIndices.length) - 6),
                11
              )}
            </text>
          ))}

          {active ? (
            <line
              className="fbc-crosshair"
              x1={xs[active.category]}
              x2={xs[active.category]}
              y1={TOP}
              y2={TOP + plotHeight}
            />
          ) : null}
          {selection && selection.category < count ? (
            <line
              className="fbc-crosshair"
              x1={xs[selection.category]}
              x2={xs[selection.category]}
              y1={TOP}
              y2={TOP + plotHeight}
            />
          ) : null}

          {series.map((entry, index) => {
            const color = seriesColorVar(entry.colorIndex);
            const segments = segmentsOf(pointsOf(index));
            return (
              <g key={entry.id}>
                {kind === "area"
                  ? segments
                      .filter((segment) => segment.length > 1)
                      .map((segment) => (
                        <path
                          key={`a-${segment[0].x}`}
                          d={areaPath(segment, baseline)}
                          fill={color}
                          fillOpacity={series.length > 1 ? 0.08 : 0.1}
                        />
                      ))
                  : null}
                {segments
                  .filter((segment) => segment.length > 1)
                  .map((segment) => (
                    <path
                      key={`l-${segment[0].x}`}
                      d={linePath(segment)}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                {segments.map((segment) => {
                  const end = segment[segment.length - 1];
                  const isLastSegment = segment === segments[segments.length - 1];
                  // The end of the line, and any value with no neighbour to draw a line to.
                  return segment.length === 1 || isLastSegment ? (
                    <circle key={`e-${end.x}`} className="fbc-dot" cx={end.x} cy={end.y} r={4} fill={color} />
                  ) : null;
                })}
                {endLabels.has(entry.id)
                  ? (() => {
                      const last = [...pointsOf(index)]
                        .reverse()
                        .find((point): point is Point => point !== null);
                      return last ? (
                        <text className="fbc-end-label" x={last.x + 10} y={last.y + 4}>
                          {truncateLabel(entry.label, END_LABEL_ROOM - 14, 11)}
                        </text>
                      ) : null;
                    })()
                  : null}
              </g>
            );
          })}

          {[active, selection].map((position, which) =>
            position && position.category < count
              ? series.map((entry, index) => {
                  const value = entry.values.at(position.category);
                  if (value === null || value === undefined) return null;
                  const chosen = index === position.series;
                  return (
                    <circle
                      key={`${which}-${entry.id}`}
                      className={which === 1 && chosen ? "fbc-dot fbc-dot-selected" : "fbc-dot"}
                      cx={xs[position.category]}
                      cy={y(value)}
                      r={which === 1 || chosen || series.length === 1 ? 5 : 4}
                      fill={seriesColorVar(entry.colorIndex)}
                    />
                  );
                })
              : null
          )}

          <rect
            className="fbc-band-hit"
            x={left}
            y={TOP}
            width={plotWidth}
            height={plotHeight}
            onPointerMove={(event) => {
              const located = locate(event);
              if (located) setActive(located);
            }}
            onClick={(event) => {
              svgRef.current?.focus({ preventScroll: true });
              const located = locate(event);
              if (located) onSelect(located);
            }}
          />
        </svg>
        {tooltip && active && anchor ? (
          <Tooltip content={tooltip} anchor={anchor} containerWidth={width} />
        ) : null}
        <span className="fb-sr-only" aria-live="polite">
          {announce(tooltip)}
        </span>
      </div>
    </div>
  );
};
