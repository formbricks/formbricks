import { useState } from "react";
import { Tooltip } from "./Tooltip";
import { type FormatContext, formatCompact, formatFull, formatPercent } from "./format";
import { OTHER_COLOR, labelColorOn, otherColorVar, paletteFor, seriesColorVar } from "./palette";
import type { PieData } from "./series";
import { announce, buildPieTooltip } from "./tooltip";
import type { Selection } from "./tooltip";

interface PieChartProps {
  pie: PieData;
  title: string;
  measureLabel: string;
  theme: "light" | "dark";
  width: number;
  context: FormatContext;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

const LABEL_MIN_SHARE = 0.08;

const polar = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.sin(angle),
  y: cy - radius * Math.cos(angle),
});

/** A ring segment from `start` to `end` (radians clockwise from twelve o'clock). */
const ringPath = (
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number
): string => {
  const sweep = end - start;
  if (sweep >= Math.PI * 2 - 1e-6) {
    // A full ring cannot be one arc: draw two halves.
    const top = polar(cx, cy, outer, 0);
    const bottom = polar(cx, cy, outer, Math.PI);
    const innerTop = polar(cx, cy, inner, 0);
    const innerBottom = polar(cx, cy, inner, Math.PI);
    return `M${top.x},${top.y} A${outer},${outer} 0 1 1 ${bottom.x},${bottom.y} A${outer},${outer} 0 1 1 ${top.x},${top.y} Z M${innerTop.x},${innerTop.y} A${inner},${inner} 0 1 0 ${innerBottom.x},${innerBottom.y} A${inner},${inner} 0 1 0 ${innerTop.x},${innerTop.y} Z`;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const a = polar(cx, cy, outer, start);
  const b = polar(cx, cy, outer, end);
  const c = polar(cx, cy, inner, end);
  const d = polar(cx, cy, inner, start);
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${outer},${outer} 0 ${large} 1 ${b.x.toFixed(2)},${b.y.toFixed(2)} L${c.x.toFixed(2)},${c.y.toFixed(2)} A${inner},${inner} 0 ${large} 0 ${d.x.toFixed(2)},${d.y.toFixed(2)} Z`;
};

/**
 * A donut for part-to-whole, seven slices at most with the tail folded into Other. The list beside it
 * carries every label and value (the slices only get a percentage when they are big enough to hold one),
 * and its rows are real buttons: the keyboard path to hover and to select a slice.
 */
export const PieChart = ({
  pie,
  title,
  measureLabel,
  theme,
  width,
  context,
  selection,
  onSelect,
}: Readonly<PieChartProps>) => {
  const [active, setActive] = useState<Selection | null>(null);
  const size = Math.min(220, Math.max(140, width - 8));
  const cx = size / 2;
  const outer = size / 2 - 4;
  const inner = outer * 0.58;
  const palette = paletteFor(theme);

  let angle = 0;
  const arcs = pie.slices.map((slice) => {
    const start = angle;
    angle += slice.share * Math.PI * 2;
    return { slice, start, end: angle };
  });

  const tooltip = active ? buildPieTooltip(pie, active, measureLabel, context) : undefined;
  const activeArc = active ? arcs[active.category] : undefined;
  const anchorAngle = activeArc ? (activeArc.start + activeArc.end) / 2 : 0;
  const anchor = polar(cx, cx, (outer + inner) / 2, anchorAngle);

  const fillOf = (colorIndex: number | null): string =>
    colorIndex === null ? OTHER_COLOR : (palette[colorIndex % palette.length] ?? OTHER_COLOR);

  return (
    <div className="fbc-pie">
      <div className="fbc-plot" style={{ width: size, flex: "none" }}>
        <svg
          className="fbc-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${title}. Donut chart with ${pie.slices.length} slices; the list beside it has every value.`}
          onPointerLeave={() => setActive(null)}>
          {arcs.map(({ slice, start, end }, index) => {
            const isActive = active?.category === index;
            const dim = active !== null && !isActive;
            const mid = (start + end) / 2;
            const lift = isActive ? 3 : 0;
            const shift = polar(0, 0, lift, mid);
            const labelPosition = polar(cx, cx, (outer + inner) / 2, mid);
            const fill = fillOf(slice.colorIndex);
            return (
              <g key={slice.id}>
                <path
                  className={dim ? "fbc-slice fbc-bar-dim" : "fbc-slice"}
                  d={ringPath(cx, cx, outer, inner, start, end)}
                  fill={slice.colorIndex === null ? otherColorVar : seriesColorVar(slice.colorIndex)}
                  transform={`translate(${shift.x.toFixed(2)} ${shift.y.toFixed(2)})`}
                  onPointerMove={() => setActive({ category: index, series: 0 })}
                  onClick={() => onSelect({ category: index, series: 0 })}
                />
                {slice.share >= LABEL_MIN_SHARE ? (
                  <text
                    className="fbc-slice-label"
                    x={labelPosition.x + shift.x}
                    y={labelPosition.y + shift.y + 4}
                    textAnchor="middle"
                    fill={labelColorOn(fill)}>
                    {formatPercent(slice.share, context.locale)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text className="fbc-center-value" x={cx} y={cx + 4} textAnchor="middle">
            {formatCompact(pie.total, context.locale)}
          </text>
          <text className="fbc-center-label" x={cx} y={cx + 20} textAnchor="middle">
            Total
          </text>
        </svg>
        {tooltip && activeArc ? <Tooltip content={tooltip} anchor={anchor} containerWidth={size} /> : null}
        <span className="fb-sr-only" aria-live="polite">
          {announce(tooltip)}
        </span>
      </div>

      <ul className="fbc-pie-list" aria-label={`${measureLabel} by slice`}>
        {pie.slices.map((slice, index) => (
          <li key={slice.id}>
            <button
              type="button"
              className="fbc-pie-row"
              data-active={active?.category === index}
              aria-pressed={selection?.category === index}
              title={`${slice.label}: ${formatFull(slice.value, context.locale)}`}
              onPointerEnter={() => setActive({ category: index, series: 0 })}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive({ category: index, series: 0 })}
              onBlur={() => setActive(null)}
              onClick={() => onSelect(selection?.category === index ? null : { category: index, series: 0 })}>
              <span
                className="fbc-swatch"
                style={{
                  background: slice.colorIndex === null ? otherColorVar : seriesColorVar(slice.colorIndex),
                }}
                aria-hidden="true"
              />
              <span className="fbc-pie-label">{slice.label}</span>
              <span className="fbc-pie-value">{formatCompact(slice.value, context.locale)}</span>
              <span className="fbc-pie-share">{formatPercent(slice.share, context.locale)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
