import type { BigNumber } from "./series";

/**
 * One headline number per measure. A single measure is the hero figure; several become a row of tiles.
 * A score with no answers to base it on says so instead of showing zero.
 */
export const BigNumbers = ({ numbers }: Readonly<{ numbers: BigNumber[] }>) => (
  <div className={numbers.length === 1 ? "fbc-numbers fbc-numbers-single" : "fbc-numbers"}>
    {numbers.map((entry) => (
      <div key={entry.id} className="fbc-number">
        <span className="fbc-number-label">{entry.label}</span>
        <span
          className={entry.value === null ? "fbc-number-value fbc-number-empty" : "fbc-number-value"}
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
