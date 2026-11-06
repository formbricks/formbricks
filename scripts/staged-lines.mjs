/* Which lines a commit stages, for the pre-commit checks that hold new code only to a rule
 * (scripts/lint-staged-eslint.mjs). */

/** The added or changed lines in a `git diff --unified=0` of one file, as inclusive [start, end] ranges. */
export function parseStagedLineRanges(diff) {
  const ranges = [];
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    // A hunk that only deletes lines (`+12,0`) adds none.
    if (count > 0) ranges.push([start, start + count - 1]);
  }
  return ranges;
}

/** Whether a lint message's lines (`line` to `endLine`) overlap any of the ranges. */
export function touchesStagedLines(message, ranges) {
  const end = message.endLine ?? message.line;
  return ranges.some(([start, stop]) => message.line <= stop && end >= start);
}
