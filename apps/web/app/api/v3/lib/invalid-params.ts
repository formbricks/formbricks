import type { InvalidParam } from "./response";

/**
 * How many `invalid_params` a v3 problem response lists, the summary entry included.
 *
 * Every producer of `invalid_params` is fed by caller-controlled input, so left unbounded the list is a
 * response-size and heap amplifier: a 2 MB body of junk array entries came back as one Zod issue per
 * entry (ENG-3384). Fifty is enough to act on; when there are more, the last entry counts the rest.
 */
export const V3_INVALID_PARAMS_MAX = 50;

/**
 * Longest `name` and `reason` a reply echoes. Both can carry caller text, such as an unknown field or a
 * locale key, and a 1.5 MB key used to come back twice in the 400 and again in the warn log. Far above
 * any real path or message: ids are at most 128 characters, and the longest fixed reason (an element's
 * allowed fields) is under 1,000.
 */
export const V3_INVALID_PARAM_NAME_MAX_CHARS = 1024;
export const V3_INVALID_PARAM_REASON_MAX_CHARS = 2048;

/** `text` cut at `max` UTF-16 units, never between the two halves of a surrogate pair. */
function clip(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const end = /[\uD800-\uDBFF]/.test(text[max - 1]) ? max - 1 : max;
  return `${text.slice(0, end)}…`;
}

const needsClip = (param: InvalidParam): boolean =>
  param.name.length > V3_INVALID_PARAM_NAME_MAX_CHARS ||
  param.reason.length > V3_INVALID_PARAM_REASON_MAX_CHARS;

/** The param with its caller-shaped text held to the limits above. */
export function clipInvalidParam(param: InvalidParam): InvalidParam {
  if (!needsClip(param)) {
    return param;
  }
  return {
    ...param,
    name: clip(param.name, V3_INVALID_PARAM_NAME_MAX_CHARS),
    reason: clip(param.reason, V3_INVALID_PARAM_REASON_MAX_CHARS),
  };
}

function omissionSummary(omitted: number, name: string, subject: string): InvalidParam {
  return {
    name,
    reason: `${omitted} further problems with this ${subject} were not reported; fix the ones above and retry`,
  };
}

/**
 * Caps an already-built list at the response boundary: at most `V3_INVALID_PARAMS_MAX` entries, the
 * last one counting what was cut. For lists that are compared before they are reported — the survey
 * validator's, which `deriveFailureOrigin` diffs against the stored survey's — the cap has to sit here
 * rather than in the producer, or a new problem past the cap is silently attributed to the stored survey.
 * `name` is the param the summary is filed under; `subject` finishes "N further problems with this …".
 */
export function capInvalidParams(params: InvalidParam[], name: string, subject: string): InvalidParam[] {
  if (params.length <= V3_INVALID_PARAMS_MAX) {
    return params.some(needsClip) ? params.map(clipInvalidParam) : params;
  }

  const kept = params.slice(0, V3_INVALID_PARAMS_MAX - 1).map(clipInvalidParam);
  return [...kept, omissionSummary(params.length - kept.length, name, subject)];
}

/**
 * Collects at most `V3_INVALID_PARAMS_MAX` params, counting the rest without building them.
 *
 * For producers whose output is never compared, only reported. `push` takes a thunk so the caller's
 * object literal — and its template strings — are never evaluated once the cap is reached. Capping only
 * the reply would still allocate every entry and then throw almost all of them away: a 2 MB body of
 * repeated block ids is ~419k entries, measured at ~500 MB of transient heap for an 8 KB 422. The kept
 * prefix matches the uncapped output for every input except for text past `clipInvalidParam`'s limits, so
 * callers that never reach the cap see no change.
 */
export class BoundedInvalidParams {
  private readonly kept: InvalidParam[] = [];
  private omitted = 0;

  constructor(private readonly max: number = V3_INVALID_PARAMS_MAX) {}

  push(build: () => InvalidParam): void {
    if (this.kept.length < this.max) {
      this.kept.push(clipInvalidParam(build()));
      return;
    }
    this.omitted += 1;
  }

  get empty(): boolean {
    return this.kept.length === 0 && this.omitted === 0;
  }

  /**
   * At most `max` entries in total. When anything was omitted the last kept entry gives way to the
   * summary, so the reply never exceeds the documented limit by one.
   */
  report(name: string, subject: string): InvalidParam[] {
    if (this.omitted === 0) {
      return this.kept;
    }

    const kept = this.kept.slice(0, this.max - 1);
    return [...kept, omissionSummary(this.omitted + (this.kept.length - kept.length), name, subject)];
  }
}
