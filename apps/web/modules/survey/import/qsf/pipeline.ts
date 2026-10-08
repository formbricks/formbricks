import "server-only";
import { logger } from "@formbricks/logger";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import type { TQsfImportReport, TQsfImportStage } from "../types";
import { type TQsfPlanGenerate, type TQsfPlanUsage, planQsfImport } from "./ai-plan";
import { type TQsfAssembly, type TQsfDraftDocument, assembleQsfDraft } from "./assemble";
import { QsfImportFailedError, QsfImportInputError } from "./errors";
import { yieldToOthers } from "./event-loop";
import { checkQsfDraftInSlices, elementsAtFault } from "./final-gate";
import { fitQsfDraftToCreateLimit, fitQsfSurveyToCreateLimit } from "./fit-draft";
import { QSF_PROMPT_BUDGET_CHARS, estimateQsfMinimumPromptChars } from "./prompt";
import type { TQsfIssue, TQsfSurvey } from "./qsf-model";
import { readQsf } from "./read-qsf";
import { buildQsfImportReport } from "./report";
import { sanitizeQsfTexts } from "./sanitize-text";

export { QsfImportFailedError, QsfImportInputError, QsfImportTimeoutError } from "./errors";

/**
 * The Qualtrics import pipeline (ENG-3654): a parsed QSF in, a v3 create document and the import
 * report out. The stream route (`/api/internal/surveys/import/stream`) is one caller; nothing here
 * knows about HTTP, so a later public route or a background job reuses it unchanged (ENG-3604).
 *
 * Two phases, because the route has to answer a bad file with a problem response before its stream
 * opens:
 *
 * - `prepareQsfImport` is the reader and its limits: synchronous and cheap (≤ ~50 ms on the largest
 *   file), throwing `QsfImportInputError` for a 422;
 * - `runQsfImport` does the rest while the stream reports progress: sanitize the texts (yielding to
 *   the event loop), ask the AI for a plan and check it (`ai`), assemble the draft and gate it with
 *   the create's own checks (`assembling`).
 *
 * The AI never writes survey text: it says which type each question becomes and which option list
 * plays which role, and the assembly copies every text from the file by key (ENG-3479).
 */

export interface TPreparedQsfImport {
  fileName: string;
  surveyName: string;
  survey: TQsfSurvey;
}

export interface TQsfImportResult {
  /**
   * The draft in the shape `POST /api/v3/surveys` takes — locale-keyed texts, not the internal `default`
   * key — because the dialog sends it there unchanged.
   */
  payload: TQsfDraftDocument;
  report: TQsfImportReport;
  /** Tokens the AI calls used, for the route's log line. Absent when no AI call ran. */
  usage?: TQsfPlanUsage;
}

export interface TRunQsfImportParams {
  prepared: TPreparedQsfImport;
  workspaceId: string;
  organizationId: string;
  userId: string | null;
  /**
   * Aborts on Stop, client disconnect and the route's deadline. Passed to every AI call; the pipeline
   * also stops between stages when it fires, since the route gives the import's concurrency slot back
   * as soon as the client leaves.
   */
  signal: AbortSignal;
  /** The route's deadline for the whole import. AI calls are sized to what is left of it. */
  deadlineMs: number;
  onProgress: (stage: TQsfImportStage) => void;
  /** The model call. The organization's AI by default; the eval script passes its own. */
  generate?: TQsfPlanGenerate;
}

/** Read and check the file, before any AI call. Throws `QsfImportInputError` for a file it cannot read. */
export function prepareQsfImport(qsf: Record<string, unknown>, fileName: string): TPreparedQsfImport {
  const survey = readQsf(qsf);
  // Every part of the prompt is bounded, so only a hostile file gets here; refuse it before the stream.
  if (estimateQsfMinimumPromptChars(survey) > QSF_PROMPT_BUDGET_CHARS) {
    throw new QsfImportInputError([
      {
        name: "qsf.SurveyElements",
        reason: "The survey's questions and logic are too large to import",
      },
    ]);
  }
  return { fileName, surveyName: survey.name, survey };
}

function organizationGenerate(params: TRunQsfImportParams): TQsfPlanGenerate {
  const aiTracing = params.userId
    ? { distinctId: params.userId, feature: AI_TRACING_FEATURE.QsfImport, workspaceId: params.workspaceId }
    : undefined;
  return (request) =>
    generateOrganizationAIObject({ organizationId: params.organizationId, aiTracing, ...request });
}

const countElements = (document: TQsfDraftDocument): number =>
  document.blocks.reduce((count, block) => count + block.elements.length, 0);

/**
 * Assemble the draft and hold it to the create's checks. A problem with one element drops that
 * element (reported) and the draft is assembled again once; a problem anywhere else, or a second
 * failure, fails the import. Only the problems' paths are logged: their reasons can quote the file.
 *
 * Assembly yields between questions, and the gate between its three checks, which are synchronous —
 * the request schema's the costliest, about 1 s on a 2 MB draft — so no stretch holds the event loop
 * for more than one of them.
 */
async function assembleCheckedDraft(
  build: (excludedRefs: ReadonlySet<string>) => Promise<TQsfAssembly>,
  survey: TQsfSurvey,
  signal: AbortSignal
): Promise<{ assembly: TQsfAssembly; dropped: TQsfIssue[] }> {
  const pause = () => yieldToOthers(signal);

  const first = await build(new Set());
  await pause();
  const problems = await checkQsfDraftInSlices(first.document, pause);
  if (problems.length === 0) return { assembly: first, dropped: [] };

  const names = problems.slice(0, 20).map((problem) => problem.name);
  const atFault = elementsAtFault(problems);
  if (!atFault) {
    logger.error({ invalidParamNames: names }, "QSF import draft failed the create check outside an element");
    throw new QsfImportFailedError("draft_invalid");
  }

  const excluded = new Set(atFault.flatMap(([block, element]) => first.elementRefs[block]?.[element] ?? []));
  logger.warn(
    { invalidParamNames: names, droppedElements: excluded.size },
    "QSF import dropped elements the create would refuse"
  );
  await pause();
  const second = await build(excluded);
  await pause();
  if ((await checkQsfDraftInSlices(second.document, pause)).length > 0) {
    throw new QsfImportFailedError("draft_invalid");
  }

  return {
    assembly: second,
    dropped: [...excluded].map((ref) => ({
      code: "question_skipped" as const,
      severity: "warning" as const,
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      questionRef: ref,
      params: { cause: "validation_failed" },
    })),
  };
}

/** Plan and assemble the survey. */
export async function runQsfImport(params: TRunQsfImportParams): Promise<TQsfImportResult> {
  const { prepared, workspaceId, organizationId, signal, onProgress } = params;
  const { survey } = prepared;
  const deadline = performance.now() + params.deadlineMs;

  signal.throwIfAborted();
  const texts = await sanitizeQsfTexts(survey, signal);

  // Cut what cannot fit the create's request body before any of it is planned or assembled: the
  // work after this is bounded by about one create body, and the AI is not paid for what goes.
  signal.throwIfAborted();
  const surveyFit = fitQsfSurveyToCreateLimit(survey, texts);
  const keepForSurvey = (issue: TQsfIssue) =>
    issue.questionRef === undefined || !surveyFit.cutRefs.has(issue.questionRef);

  signal.throwIfAborted();
  onProgress("ai");
  const planned = await planQsfImport({
    survey,
    texts,
    generate: params.generate ?? organizationGenerate(params),
    signal,
    deadline,
  });

  signal.throwIfAborted();
  onProgress("assembling");
  if (planned.plan.questions.size === 0) throw new QsfImportFailedError("no_questions");

  // Only asked when there is a redirect to keep: on Cloud it is a billing lookup.
  const allowExternalUrls = survey.endRedirectUrl ? await getExternalUrlsPermission(organizationId) : false;
  signal.throwIfAborted();

  const { assembly, dropped } = await assembleCheckedDraft(
    (excludedRefs) =>
      assembleQsfDraft({
        survey,
        texts,
        plan: planned.plan,
        workspaceId,
        allowExternalUrls,
        excludedRefs,
        signal,
      }),
    survey,
    signal
  );
  // The dialog creates the draft through POST /api/v3/surveys, whose body has a size limit. The survey
  // was cut to an upper bound of it before planning; past it still, languages and then trailing
  // questions are cut, and only then is the cut draft checked again.
  await yieldToOthers(signal);
  const fitted = fitQsfDraftToCreateLimit(assembly, survey);
  if (countElements(assembly.document) === 0) throw new QsfImportFailedError("no_questions");
  if (fitted.dropped.length > 0) {
    await yieldToOthers(signal);
    const problems = await checkQsfDraftInSlices(assembly.document, () => yieldToOthers(signal));
    if (problems.length > 0) throw new QsfImportFailedError("draft_invalid");
  }

  const issues = [
    ...survey.issues.filter(keepForSurvey),
    ...texts.issues.filter(keepForSurvey),
    ...surveyFit.issues,
    ...planned.issues,
    ...dropped,
    ...assembly.issues,
  ];
  return {
    payload: assembly.document,
    report: buildQsfImportReport({
      fileName: prepared.fileName,
      document: assembly.document,
      issues: [...issues.filter(fitted.keepIssue), ...fitted.dropped],
    }),
    ...(planned.calls > 0 ? { usage: planned.usage } : {}),
  };
}
