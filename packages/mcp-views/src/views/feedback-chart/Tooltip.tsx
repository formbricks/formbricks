import { otherColorVar, seriesColorVar } from "./palette";
import type { TooltipContent } from "./tooltip";

export interface TooltipAnchor {
  x: number;
  y: number;
}

const colorOf = (index: number | null | undefined): string | undefined => {
  if (index === undefined) return undefined;
  return index === null ? otherColorVar : seriesColorVar(index);
};

/**
 * Hover and focus readout. Decorative for assistive technology: the same text goes to a live region, and
 * the table view lists every value. Values lead and names follow; each row is keyed by a short stroke of
 * the series colour, never by coloured text. Every string is rendered as text, never as markup.
 */
export const Tooltip = ({
  content,
  anchor,
  containerWidth,
}: Readonly<{ content: TooltipContent; anchor: TooltipAnchor; containerWidth: number }>) => {
  const flip = anchor.x > containerWidth / 2;
  return (
    <div
      className="fbc-tip"
      aria-hidden="true"
      style={{
        left: anchor.x,
        top: Math.max(0, anchor.y),
        transform: flip ? "translate(calc(-100% - 12px), -50%)" : "translate(12px, -50%)",
      }}>
      <div className="fbc-tip-title">{content.title}</div>
      {content.rows.map((row, index) => {
        const color = colorOf(row.colorIndex);
        return (
          <div
            key={`${row.label}-${index}`}
            className={row.emphasis ? "fbc-tip-row fbc-tip-row-emphasis" : "fbc-tip-row"}>
            {color ? <span className="fbc-tip-key" style={{ background: color }} /> : null}
            <span className="fbc-tip-label">{row.label}</span>
            <span className="fbc-tip-value">{row.value}</span>
          </div>
        );
      })}
    </div>
  );
};
