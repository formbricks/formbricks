import { countIssues } from "../report";
import type { TImportLane, TImportReport, TImportSourceKind } from "../types";

/**
 * Property sets of the server-side import events, in one place so the convert route, the stream
 * route and the import route report the same shape (ENG-3008). Event names:
 *
 * - `survey_import_converted` — every convert/stream `done`, whether or not a document came out.
 * - `survey_import_failed` — every fatal answer (400/409/413/415/422/429/5xx) and in-band `error` event.
 * - `survey_created` with `created_from: "import"` carries `buildImportCreatedProperties`.
 * - `ai_survey_imported` — the AI lane's own event (chunks, languages, duration).
 */

export type TImportConvertedProperties = {
  source_kind: TImportSourceKind;
  lane: TImportLane;
  question_count: number;
  language_count: number;
  warning_count: number;
  error_count: number;
  /** Distinct warning codes, for the "what do imports lose" histogram. */
  import_warning_codes: string[];
  has_document: boolean;
  duration_ms: number;
  streamed?: boolean;
};

export function buildImportConvertedProperties(
  report: TImportReport,
  options: { durationMs: number; hasDocument: boolean; streamed?: boolean }
): TImportConvertedProperties {
  const counts = countIssues(report.issues);
  return {
    source_kind: report.source.kind,
    lane: report.source.lane,
    question_count: report.summary.elements,
    language_count: report.summary.languages.length,
    warning_count: counts.warning,
    error_count: counts.error,
    import_warning_codes: [
      ...new Set(report.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.code)),
    ].sort(),
    has_document: options.hasDocument,
    duration_ms: options.durationMs,
    ...(options.streamed === undefined ? {} : { streamed: options.streamed }),
  };
}

export type TImportFailedProperties = {
  source_kind: TImportSourceKind | null;
  lane: TImportLane | null;
  /** The problem code (`unsupported_source`, `ai_quota_exceeded`, …) or the fatal report code. */
  code: string;
  status: number | null;
  streamed?: boolean;
};

export function buildImportFailedProperties(params: {
  sourceKind?: TImportSourceKind | null;
  lane?: TImportLane | null;
  code: string;
  status?: number | null;
  streamed?: boolean;
}): TImportFailedProperties {
  return {
    source_kind: params.sourceKind ?? null,
    lane: params.lane ?? null,
    code: params.code,
    status: params.status ?? null,
    ...(params.streamed === undefined ? {} : { streamed: params.streamed }),
  };
}

/** The extra properties `survey_created` carries when `created_from` is `import`. */
export function buildImportCreatedProperties(
  report: TImportReport
): Record<string, string | number | boolean> {
  const counts = countIssues(report.issues);
  return {
    import_source: report.source.kind,
    import_lane: report.source.lane,
    import_ai_used: report.source.lane === "ai",
    import_warning_count: counts.warning,
    import_chunk_count: report.source.chunks ?? 0,
  };
}

/** Reads the problem code out of a problem+json Response without consuming the caller's copy. */
export async function readProblemCode(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return typeof body.code === "string" ? body.code : `http_${response.status}`;
  } catch {
    return `http_${response.status}`;
  }
}
