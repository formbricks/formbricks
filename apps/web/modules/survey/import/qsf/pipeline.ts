import "server-only";
import { z } from "zod";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import type { TV3CreateSurveyRequestBody } from "@/app/api/v3/surveys/schemas";
import type { TQsfImportReport, TQsfImportStage } from "../types";

/**
 * The Qualtrics import pipeline: a parsed QSF in, a v3 create document and the import report out.
 * The stream route (`/api/internal/surveys/import/stream`) is one caller; nothing here knows about
 * HTTP, so a later public route or a background job reuses it unchanged (ENG-3604).
 *
 * Two phases, because the route has to answer a bad file with a problem response before its stream
 * opens: `prepareQsfImport` is the synchronous reader and its guards; `runQsfImport` is the AI call and
 * the assembly, which run while the stream reports progress.
 *
 * **Stub.** The reader, the AI plan and the assembly land with ENG-3654. Until then `prepareQsfImport`
 * checks only the QSF envelope and `runQsfImport` returns a fixed one-question draft, so the import
 * dialog (ENG-3655) can be built against the real route.
 */

/** The file is not a Qualtrics survey export the import can read. Answered as a 422 before streaming. */
export class QsfImportInputError extends Error {
  readonly invalidParams: InvalidParam[];

  constructor(invalidParams: InvalidParam[]) {
    super("The file is not a Qualtrics survey export (.qsf).");
    this.name = "QsfImportInputError";
    this.invalidParams = invalidParams;
  }
}

export interface TPreparedQsfImport {
  fileName: string;
  surveyName: string;
}

export interface TQsfImportResult {
  /**
   * The draft in the shape `POST /api/v3/surveys` takes — locale-keyed texts, not the internal `default`
   * key — because the dialog sends it there unchanged.
   */
  payload: TV3CreateSurveyRequestBody;
  report: TQsfImportReport;
  /** Tokens the AI call used, for the route's log line. Absent when no AI call ran. */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface TRunQsfImportParams {
  prepared: TPreparedQsfImport;
  workspaceId: string;
  organizationId: string;
  userId: string | null;
  /**
   * Aborts on Stop, client disconnect and the route's deadline. Pass it to the AI call, and stop
   * promptly when it fires: the route gives the import's concurrency slot back as soon as the client
   * leaves, so work that carries on after that is work the limit no longer counts.
   */
  signal: AbortSignal;
  onProgress: (stage: TQsfImportStage) => void;
}

/**
 * The part of the QSF envelope every Qualtrics export has. Loose on purpose: QSF has no published
 * schema and Qualtrics adds keys between versions (ENG-3609); the reader in ENG-3654 decides what the
 * rest means.
 */
const ZQsfEnvelope = z.looseObject({
  SurveyEntry: z.looseObject({ SurveyName: z.string().trim().min(1) }),
  SurveyElements: z.array(z.unknown()),
});

/** Read and check the file, before any AI call. Throws `QsfImportInputError` for a file it cannot read. */
export function prepareQsfImport(qsf: Record<string, unknown>, fileName: string): TPreparedQsfImport {
  const envelope = ZQsfEnvelope.safeParse(qsf);
  if (!envelope.success) {
    throw new QsfImportInputError(
      envelope.error.issues.map((issue) => ({
        name: ["qsf", ...issue.path.map(String)].join("."),
        reason: issue.message,
      }))
    );
  }

  return { fileName, surveyName: envelope.data.SurveyEntry.SurveyName };
}

/**
 * Plan and assemble the survey. Stubbed until ENG-3654 (see the module comment).
 *
 * Asynchronous by contract, since the real pipeline awaits the AI call; the stub has nothing to wait
 * for, and `Promise.try` keeps its failures rejections rather than throws, as the real one's will be.
 */
export function runQsfImport(params: TRunQsfImportParams): Promise<TQsfImportResult> {
  return Promise.try(() => assembleStubDraft(params));
}

function assembleStubDraft({
  prepared,
  workspaceId,
  signal,
  onProgress,
}: TRunQsfImportParams): TQsfImportResult {
  signal.throwIfAborted();
  onProgress("ai");
  signal.throwIfAborted();
  onProgress("assembling");

  const payload: TV3CreateSurveyRequestBody = {
    workspaceId,
    name: `${prepared.surveyName} (imported)`,
    type: "link",
    status: "draft",
    blocks: [
      {
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "openText",
            headline: { "en-US": "Imported question" },
            required: false,
            inputType: "text",
          },
        ],
      },
    ],
  };

  // The same preparation POST /api/v3/surveys runs, so a draft the dialog shows is one it can create.
  // Not `ZV3CreateSurveyBody.parse`: its output carries the internal `default` translation key, which
  // the public create refuses.
  const preparation = prepareV3SurveyCreateInput(payload);
  if (!preparation.ok) {
    throw new Error("The assembled import draft does not pass create validation");
  }

  return {
    payload,
    report: {
      source: { kind: "qsf", fileName: prepared.fileName },
      summary: { blocks: 1, questions: 1, languages: ["en-US"], logicRules: 0, hiddenFields: 0 },
      issues: [],
    },
  };
}
