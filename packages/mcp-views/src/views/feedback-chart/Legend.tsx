import { seriesColorVar } from "./palette";
import type { Series } from "./series";

/**
 * Identity is never colour alone: with two or more series a legend is always shown. A single series needs
 * none, because the chart's title already names it. The key mirrors the mark: a stroke for lines, a
 * square for bars.
 */
export const Legend = ({ series, mark }: Readonly<{ series: Series[]; mark: "line" | "square" }>) => {
  if (series.length < 2) return null;
  return (
    <ul className="fbc-legend" aria-label="Legend">
      {series.map((entry) => (
        <li key={entry.id} className="fbc-legend-item" title={entry.label}>
          <span
            className={mark === "line" ? "fbc-swatch fbc-swatch-line" : "fbc-swatch"}
            style={{ background: seriesColorVar(entry.colorIndex) }}
            aria-hidden="true"
          />
          <span className="fbc-legend-label">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
};
