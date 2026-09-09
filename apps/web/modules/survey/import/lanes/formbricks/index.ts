import {
  SURVEY_EXPORT_FORMAT,
  type TSurveyExportReferences,
  ZSurveyExportMetadata,
  ZSurveyExportReferences,
  getSurveyExportFormat,
} from "@/app/api/v3/surveys/export/schemas";
import { formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { detectJsonSourceKind } from "../../detect";
import { importError, importInfo } from "../../report";
import type {
  TImportCandidate,
  TImportIssue,
  TImportLaneHandler,
  TImportLaneInput,
  TImportReportSource,
} from "../../types";

/**
 * Instance-bound fields a hand-edited file may carry. They are removed here, before the resolver's
 * strict unknown-field pass, so the user reads "slug not imported" rather than "unsupported field".
 * `status`, `publishOn` and `closeOn` are reported because they change behaviour; the rest is noise.
 */
const SILENTLY_STRIPPED_ROOT_FIELDS = [
  "id",
  "workspaceId",
  "createdAt",
  "updatedAt",
  "archivedAt",
  "createdBy",
] as const;

const ENVELOPE_ROOT_KEYS = new Set(["formbricks", "survey", "references"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseContent(input: TImportLaneInput): { value: unknown } | { error: TImportIssue } {
  const { content } = input;
  if (content.type === "json") {
    return { value: content.value };
  }

  const text = content.type === "text" ? content.text : content.bytes.toString("utf8");

  try {
    return { value: JSON.parse(stripBom(text)) };
  } catch {
    return {
      error: importError({
        code: "invalid_document",
        vars: { detail: "The file is not valid JSON." },
      }),
    };
  }
}

/** Accept a `GET /api/v3/surveys/{id}` response body as well as the bare document. */
function unwrapDataEnvelope(value: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(value.data) && detectJsonSourceKind(value.data) !== null && !("blocks" in value)) {
    return value.data;
  }
  return value;
}

function stripInstanceFields(
  document: Record<string, unknown>,
  issues: TImportIssue[]
): Record<string, unknown> {
  const stripped = { ...document };

  for (const field of SILENTLY_STRIPPED_ROOT_FIELDS) {
    delete stripped[field];
  }

  if ("slug" in stripped) {
    delete stripped.slug;
    issues.push(importInfo({ code: "slug_not_imported", path: "slug" }));
  }

  if (stripped.publishOn != null || stripped.closeOn != null) {
    issues.push(importInfo({ code: "schedule_cleared", path: "publishOn" }));
  }
  delete stripped.publishOn;
  delete stripped.closeOn;

  return stripped;
}

function hasLegacyQuestions(document: Record<string, unknown>): boolean {
  return Array.isArray(document.questions) && document.questions.length > 0;
}

type TEnvelopeParts =
  | { ok: true; survey: Record<string, unknown>; references: TSurveyExportReferences; issues: TImportIssue[] }
  | { ok: false; issues: TImportIssue[] };

function readEnvelope(value: Record<string, unknown>): TEnvelopeParts {
  const issues: TImportIssue[] = [];
  const format = getSurveyExportFormat(value);

  if (format !== null && format > SURVEY_EXPORT_FORMAT) {
    return {
      ok: false,
      issues: [
        importError({ code: "export_format_unsupported", path: "formbricks.exportFormat", vars: { format } }),
      ],
    };
  }

  const metadata = ZSurveyExportMetadata.safeParse(value.formbricks);
  if (!metadata.success) {
    return {
      ok: false,
      issues: formatV3ZodInvalidParams(metadata.error, "formbricks").map((param) =>
        importError({
          code: "invalid_document",
          path: param.name.startsWith("formbricks") ? param.name : `formbricks.${param.name}`,
          vars: { detail: `Export metadata is invalid: ${param.reason}` },
        })
      ),
    };
  }

  const references = ZSurveyExportReferences.safeParse(value.references ?? { actionClasses: [] });
  if (!references.success) {
    return {
      ok: false,
      issues: formatV3ZodInvalidParams(references.error, "references").map((param) =>
        importError({
          code: "invalid_document",
          path: param.name.startsWith("references") ? param.name : `references.${param.name}`,
          vars: { detail: `Action-class references are invalid: ${param.reason}` },
        })
      ),
    };
  }

  if (!isRecord(value.survey)) {
    return {
      ok: false,
      issues: [
        importError({
          code: "invalid_document",
          path: "survey",
          vars: { detail: "The export has no survey document." },
        }),
      ],
    };
  }

  // A pre-D1 draft file with an `extensions` block, or any other stray root key, is reported here
  // because the resolver only ever sees `survey`.
  for (const key of Object.keys(value)) {
    if (!ENVELOPE_ROOT_KEYS.has(key)) {
      issues.push(importInfo({ code: "unknown_field_stripped", path: key, vars: { field: key } }));
    }
  }

  return { ok: true, survey: value.survey, references: references.data, issues };
}

function fatal(source: TImportReportSource, issues: TImportIssue[]): TImportCandidate {
  return { document: null, issues, source };
}

/**
 * Lossless lane: a Formbricks export envelope or a raw v3 survey document (what the MCP
 * `create_survey` tool and a `GET /api/v3/surveys/{id}` response carry). No mapping happens here;
 * the document goes to the resolver as it is, minus the instance-bound fields.
 */
export const formbricksLane: TImportLaneHandler = async (input) => {
  const source: TImportReportSource = {
    lane: "lossless",
    kind: input.kind,
    ...(input.fileName ? { fileName: input.fileName } : {}),
  };

  const parsed = parseContent(input);
  if ("error" in parsed) {
    return fatal(source, [parsed.error]);
  }

  if (!isRecord(parsed.value)) {
    return fatal(source, [
      importError({
        code: "invalid_document",
        vars: { detail: "The file does not contain a survey object." },
      }),
    ]);
  }

  const value = unwrapDataEnvelope(parsed.value);
  const issues: TImportIssue[] = [];
  let survey: Record<string, unknown>;
  let references: TSurveyExportReferences | undefined;

  if (detectJsonSourceKind(value) === "formbricks-export") {
    const envelope = readEnvelope(value);
    if (!envelope.ok) {
      return fatal({ ...source, kind: "formbricks-export" }, envelope.issues);
    }
    source.kind = "formbricks-export";
    survey = envelope.survey;
    references = envelope.references;
    issues.push(...envelope.issues);
  } else {
    source.kind = "v3-document";
    survey = value;
  }

  if (hasLegacyQuestions(survey)) {
    return fatal(source, [importError({ code: "legacy_questions_unsupported", path: "questions" })]);
  }

  const document = stripInstanceFields(survey, issues);
  delete document.questions;

  return {
    document,
    ...(references ? { references } : {}),
    issues,
    source,
  };
};
