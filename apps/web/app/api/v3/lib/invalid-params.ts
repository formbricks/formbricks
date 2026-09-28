import type { InvalidParam } from "./response";

/**
 * How many `invalid_params` a v3 problem response lists before it stops enumerating them.
 *
 * Every producer of `invalid_params` is fed by caller-controlled input, so left unbounded the list is a
 * response-size and heap amplifier: a 2 MB body of junk array entries came back as one Zod issue per
 * entry (ENG-3384). Fifty is enough to act on; the rest is counted in one trailing entry.
 */
export const V3_INVALID_PARAMS_MAX = 50;

/**
 * Collects at most `V3_INVALID_PARAMS_MAX` params, counting the rest without building them.
 *
 * `push` takes a thunk so the caller's object literal — and its template strings — are never evaluated
 * once the cap is reached. Capping only the reply would still allocate every entry and then throw
 * almost all of them away: a 2 MB body of repeated block ids is ~419k entries, measured at ~500 MB of
 * transient heap for an 8 KB 422. The kept prefix is byte-identical to the uncapped output for every
 * input, so callers that never reach the cap see no change.
 */
export class BoundedInvalidParams {
  private readonly kept: InvalidParam[] = [];
  private omitted = 0;

  constructor(private readonly max: number = V3_INVALID_PARAMS_MAX) {}

  push(build: () => InvalidParam): void {
    if (this.kept.length < this.max) {
      this.kept.push(build());
      return;
    }
    this.omitted += 1;
  }

  get empty(): boolean {
    return this.kept.length === 0 && this.omitted === 0;
  }

  /**
   * The kept params, plus one summary entry when anything was omitted. `name` is the param the summary
   * is filed under (the array for a reorder, the body for a parse failure); `subject` finishes the
   * sentence "N further problems with this …".
   */
  report(name: string, subject: string): InvalidParam[] {
    if (this.omitted === 0) {
      return this.kept;
    }

    return [
      ...this.kept,
      {
        name,
        reason: `${this.omitted} further problems with this ${subject} were not reported; fix the ones above and retry`,
      },
    ];
  }
}
