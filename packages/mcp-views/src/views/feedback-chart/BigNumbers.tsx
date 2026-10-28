import type { BigNumber } from "./series";

/**
 * One headline number per measure. A single measure is the hero figure; several become a row of tiles.
 * A score with no answers to base it on says so instead of showing zero.
 */
export const BigNumbers = ({ numbers }: Readonly<{ numbers: BigNumber[] }>) => (
  <div className={`fbc-numbers${numbers.length === 1 ? "fbc-numbers-single" : ""}`}>
    {numbers.map((entry) => (
      <div key={entry.id} className="fbc-number">
        <span className="fbc-number-label">{entry.label}</span>
        <span
          className={`fbc-number-value${entry.value === null ? "fbc-number-empty" : ""}`}
          title={entry.full}>
          {entry.compact}
        </span>
        {entry.value !== null && entry.compact !== entry.full ? (
          <span className="fbc-hint">{entry.full}</span>
        ) : null}
        {entry.value === null ? <span className="fbc-hint">{entry.full}</span> : null}
      </div>
    ))}
  </div>
);
