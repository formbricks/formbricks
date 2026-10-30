import "server-only";
import { logger } from "@formbricks/logger";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { getAITimeoutMs } from "@/lib/ai/timeout";
import { AI_TRACING_FEATURE } from "@/lib/posthog/ai-tracing-feature";
import type { TImportPlanGenerate } from "../core/ai-plan";
import type { TSurveyImportAssembly, TSurveyImportDraft } from "../core/draft";
import { SurveyImportFailedError } from "../core/errors";
import { yieldToOthers } from "../core/event-loop";
import { checkImportDraftInSlices, elementsAtFault } from "../core/final-gate";
import { fitDraftToCreateLimit } from "../core/fit-draft";
import { getImportedSurveyName, getImporterTranslate } from "../core/imported-survey-name";
import type { TSurveyImportResult, TSurveyImportRunParams } from "../core/lane";
import { type TSurveyImportPipelineIssue, buildSurveyImportReport } from "../core/report";
import { sanitizeName } from "../core/sanitize-text";
import {
  SURVEY_IMPORT_AI_CALL_TIMEOUT_MS,
  SURVEY_IMPORT_AI_MAX_SOURCE_CHARS,
  SURVEY_IMPORT_MAX_NAME_CHARS,
  SURVEY_IMPORT_MAX_QUESTIONS,
} from "../limits";
import { DOCUMENT_MAX_CHUNKS, countDocumentChunks, planDocumentImport } from "./ai-plan";
import { assembleDocumentDraft } from "./assemble";
import { documentLimitExceeded } from "./errors";
import type { TDocumentModel } from "./model";
import { type TDocumentPlannedEntry, collapseWhitespace, orderedEntries } from "./plan-checks";

/**
 * The document import pipeline (ENG-6852): a question list read into the keyed model in, a v3 create
 * document and the import report out. It is the Excel and CSV lane (`documentImportLane`); nothing here
 * knows about HTTP or about the kind of file, so a Word reader plugs in by building the same model.
 *
 * - `prepareDocumentImport` holds the model to the AI ceiling before the stream opens: past 240k
 *   characters, or more chunks than the AI budget plans, the file is refused with a 422 and the dialog
 *   points at MCP (decision 18);
 * - `runDocumentImport` plans (`ai`), refuses a plan of more than 200 questions with the same pointer,
 *   then names, assembles and gates the draft (`assembling`).
 *
 * The AI never writes survey text (decision 17): the plan names cells and quotes the parts of a cell it
 * splits, and only what is found in the cell word for word is used, copied from the cell.
 */

export interface TPreparedDocumentImport {
  fileName: string;
  model: TDocumentModel;
}

/** A document lane's run, plus the model call an eval script or a test swaps in. */
export interface TRunDocumentImportParams extends TSurveyImportRunParams<TPreparedDocumentImport> {
  generate?: TImportPlanGenerate;
}

/** Hold a read document to the AI ceiling, before any AI call. */
export function prepareDocumentImport(model: TDocumentModel, fileName: string): TPreparedDocumentImport {
  if (model.sourceChars > SURVEY_IMPORT_AI_MAX_SOURCE_CHARS) {
    throw documentLimitExceeded(
      "source_size",
      "file",
      `The file's text must not exceed ${SURVEY_IMPORT_AI_MAX_SOURCE_CHARS} characters`
    );
  }
  if (countDocumentChunks(model) > DOCUMENT_MAX_CHUNKS) {
    throw documentLimitExceeded("source_size", "file", "The file has more lines than one import can plan");
  }
  return { fileName, model };
}

function organizationGenerate(params: TRunDocumentImportParams): TImportPlanGenerate {
  const aiTracing = params.userId
    ? { distinctId: params.userId, feature: AI_TRACING_FEATURE.SurveyImport, workspaceId: params.workspaceId }
    : undefined;
  return (request) =>
    generateOrganizationAIObject({ organizationId: params.organizationId, aiTracing, ...request });
}

/** The file name without its extension: `Visitor survey.xlsx` → `Visitor survey`. */
const withoutExtension = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
};

/**
 * The survey's name (decision 20): the title the file declares, else the title line the AI found, else
 * the file name — sanitized, capped, then "(imported N)".
 */
async function nameDraft(
  prepared: TPreparedDocumentImport,
  titleCell: string | null,
  params: Pick<TRunDocumentImportParams, "workspaceId" | "userId">
): Promise<string> {
  const candidates = [
    prepared.model.title,
    titleCell === null ? null : (prepared.model.cells.get(titleCell) ?? null),
    withoutExtension(prepared.fileName),
  ];
  const base =
    candidates
      .map((candidate) => (candidate === null ? "" : sanitizeName(collapseWhitespace(candidate))))
      .find((candidate) => candidate.length > 0) ?? "";
  const capped = base.slice(0, SURVEY_IMPORT_MAX_NAME_CHARS).trim() || "Imported survey";
  return getImportedSurveyName(params.workspaceId, capped, await getImporterTranslate(params.userId));
}

const countQuestions = (entries: readonly TDocumentPlannedEntry[]): number =>
  entries.filter((entry) => entry.kind !== "welcome" && entry.kind !== "ending").length;

const countElements = (document: TSurveyImportDraft): number =>
  document.blocks.reduce((count, block) => count + block.elements.length, 0);

/**
 * Assemble the draft and hold it to the create's checks. A problem with elements drops them (reported)
 * and the draft is assembled again; a problem anywhere else is the logic built from the file's routing,
 * so the draft is assembled again without it, every rule reported as not imported. Still failing, the
 * import fails. Only the problems' paths are logged: their reasons can quote the file.
 */
async function assembleCheckedDraft(
  build: (options: {
    excludedRefs: ReadonlySet<string>;
    withoutLogic: boolean;
  }) => Promise<TSurveyImportAssembly>,
  signal: AbortSignal
): Promise<{ assembly: TSurveyImportAssembly; dropped: TSurveyImportPipelineIssue[] }> {
  const pause = () => yieldToOthers(signal);
  let excludedRefs = new Set<string>();
  let withoutLogic = false;

  // At most three passes: as built, without the elements at fault, and without logic.
  for (let pass = 0; pass < 3; pass += 1) {
    const assembly = await build({ excludedRefs, withoutLogic });
    await pause();
    const problems = await checkImportDraftInSlices(assembly.document, pause);
    if (problems.length === 0) {
      return {
        assembly,
        dropped: [...excludedRefs].map((ref) => ({
          code: "question_skipped" as const,
          severity: "warning" as const,
          questionTag: ref,
          questionRef: ref,
          params: { cause: "validation_failed" },
        })),
      };
    }

    const names = problems.slice(0, 20).map((problem) => problem.name);
    const atFault = elementsAtFault(problems);
    if (atFault) {
      excludedRefs = new Set([
        ...excludedRefs,
        ...atFault.flatMap(([block, element]) => assembly.elementRefs[block]?.[element] ?? []),
      ]);
      logger.warn({ invalidParamNames: names }, "Document import dropped elements the create would refuse");
    } else if (withoutLogic) {
      break;
    } else {
      withoutLogic = true;
      logger.warn({ invalidParamNames: names }, "Document import left out logic the create would refuse");
    }
    await pause();
  }

  throw new SurveyImportFailedError("draft_invalid");
}

/** Plan and assemble the document. */
export async function runDocumentImport(
  params: TRunDocumentImportParams
): Promise<TSurveyImportResult<TSurveyImportDraft>> {
  const { prepared, workspaceId, signal, onProgress } = params;
  const deadline = performance.now() + params.deadlineMs;

  signal.throwIfAborted();
  onProgress("ai");
  const planned = await planDocumentImport({
    model: prepared.model,
    generate: params.generate ?? organizationGenerate(params),
    signal,
    deadline,
    callTimeoutMs: getAITimeoutMs(SURVEY_IMPORT_AI_CALL_TIMEOUT_MS),
  });

  signal.throwIfAborted();
  onProgress("assembling");
  const entries = orderedEntries(planned.context, planned.plan);
  // The AI ceiling on questions (decision 18): a survey this large is imported through MCP instead.
  if (countQuestions(entries) > SURVEY_IMPORT_MAX_QUESTIONS)
    throw new SurveyImportFailedError("too_many_questions");
  if (countQuestions(entries) === 0) throw new SurveyImportFailedError("no_questions");
  const languages = planned.context.languages;
  if (!languages) throw new SurveyImportFailedError("no_questions");

  const name = await nameDraft(prepared, planned.context.titleCell, params);
  signal.throwIfAborted();

  const { assembly, dropped } = await assembleCheckedDraft(
    ({ excludedRefs, withoutLogic }) =>
      assembleDocumentDraft({ entries, languages, name, workspaceId, excludedRefs, withoutLogic, signal }),
    signal
  );
  const labelOf = (ref: string) => entries.find((entry) => entry.ref === ref)?.label ?? ref;
  // The dialog sends the draft to the create, whose body has a size limit: past it, languages and then
  // trailing questions are cut, and the cut draft is checked again.
  await yieldToOthers(signal);
  const fitted = fitDraftToCreateLimit(assembly, labelOf);
  if (countElements(assembly.document) === 0) throw new SurveyImportFailedError("no_questions");
  if (fitted.dropped.length > 0) {
    const problems = await checkImportDraftInSlices(assembly.document, () => yieldToOthers(signal));
    if (problems.length > 0) throw new SurveyImportFailedError("draft_invalid");
  }

  const skippedSheets: TSurveyImportPipelineIssue[] =
    prepared.model.skippedParts.length > 0
      ? [
          {
            code: "sheets_skipped",
            severity: "info",
            params: { sheets: prepared.model.skippedParts.join(", ") },
          },
        ]
      : [];
  // A text file says how it was read: a list saved as Windows-1252 shows its accents only if read so.
  const encodingNote: TSurveyImportPipelineIssue[] = prepared.model.encoding
    ? [{ code: "file_encoding", severity: "info", params: { encoding: prepared.model.encoding } }]
    : [];
  const issues = [...encodingNote, ...skippedSheets, ...planned.issues, ...dropped, ...assembly.issues].map(
    (issue) =>
      issue.questionRef !== undefined && issue.questionTag === issue.questionRef
        ? { ...issue, questionTag: labelOf(issue.questionRef) }
        : issue
  );

  return {
    payload: assembly.document,
    // A document points at nothing outside itself; the dialog creates it through the import's own create,
    // which names it and makes a repeat create one survey.
    references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
    report: buildSurveyImportReport({
      source: { kind: prepared.model.kind, fileName: prepared.fileName },
      document: assembly.document,
      issues: [...issues.filter(fitted.keepIssue), ...fitted.dropped],
    }),
    ...(planned.calls > 0 ? { usage: planned.usage } : {}),
  };
}
