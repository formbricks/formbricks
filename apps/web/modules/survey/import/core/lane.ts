import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import type { TFormbricksFileReferences } from "@/modules/survey/formbricks-file/envelope";
import type { TSurveyImportReport, TSurveyImportSourceKind, TSurveyImportStage } from "../types";
import type { TSurveyImportPayload } from "./draft";

/**
 * A lane: what the import does with one kind of file (ENG-6846). The stream route runs any lane the
 * same way, so a new file type adds a lane, not a route:
 *
 * - `prepare` reads and checks the file before the response opens — cheap, throwing
 *   `SurveyImportInputError` for a 422 — because once a 200 has started there is no way back to a
 *   problem response. A lane that needs the workspace to check the file (a Formbricks file's
 *   references, its entitlements) does that here, asynchronously; one that does not stays synchronous;
 * - `run` does the rest while the stream reports progress, and returns the draft and its report.
 *
 * A lane that plans with AI (`usesAI`) is held to the organization's AI gate before `prepare`, and
 * reports the `ai` stage; one that does not goes from `reading` to `assembling`. Nothing in a lane
 * knows about HTTP, so a later public route or a background job reuses it unchanged.
 *
 * The route itself charges every upload to the default v3 bucket, before it knows the file's type; a
 * lane with a costlier budget of its own names it in `rateLimit`, charged once the type is known and
 * before the lane reads the file.
 */
export interface TSurveyImportLane<TInput, TPrepared> {
  /** The kind of file the lane reads: the report's `source.kind`, and the route's log field. */
  kind: TSurveyImportSourceKind;
  usesAI: boolean;
  /**
   * The rate limit the lane is charged on top of the route's default v3 bucket: Create with AI's bucket
   * for a lane that spends AI tokens, `null` for one the default bucket covers.
   */
  rateLimit: TRateLimitConfig | null;
  prepare: (input: TInput) => TPrepared | Promise<TPrepared>;
  run: (params: TSurveyImportRunParams<TPrepared>) => Promise<TSurveyImportResult>;
}

export interface TSurveyImportRunParams<TPrepared> {
  prepared: TPrepared;
  workspaceId: string;
  organizationId: string;
  userId: string | null;
  /**
   * Aborts on Stop, client disconnect and the route's deadline. Passed to every AI call; the lane
   * also stops between stages when it fires, since the route gives the import's concurrency slot back
   * as soon as the client leaves.
   */
  signal: AbortSignal;
  /** The route's deadline for the whole import. AI calls are sized to what is left of it. */
  deadlineMs: number;
  onProgress: (stage: TSurveyImportStage) => void;
}

/**
 * `TPayload` narrows the draft for a lane that knows its shape: the Qualtrics lane's is always an
 * assembled `TSurveyImportDraft`.
 */
export interface TSurveyImportResult<TPayload extends TSurveyImportPayload = TSurveyImportPayload> {
  /**
   * The draft in the shape `POST /api/v3/surveys` takes — locale-keyed texts, not the internal `default`
   * key — because the dialog sends it there unchanged.
   */
  payload: TPayload;
  report: TSurveyImportReport;
  /**
   * What the draft points at outside itself, for a lane whose file carries it (a Formbricks file). The
   * dialog sends it back with the draft to `POST /api/internal/surveys/imports`, which resolves it again.
   */
  references?: TFormbricksFileReferences;
  /** Tokens the AI calls used, for the route's log line. Absent when no AI call ran. */
  usage?: { inputTokens: number; outputTokens: number };
}
