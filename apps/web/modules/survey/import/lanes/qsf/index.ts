import { hasFatalIssues } from "../../report";
import type { TImportCandidate, TImportIssue, TImportLaneHandler, TImportReportSource } from "../../types";
import { describeQsfLogic } from "./describe-logic";
import { mapEmbeddedDataFieldName } from "./embedded-data";
import { QsfIdRegistry } from "./id-registry";
import { applyPipedTextToDocument } from "./map-piped-text";
import { type TQsfQuestionMapping, mapQsfQuestion } from "./map-question";
import { buildQsfDocument } from "./map-structure";
import { parseQsf } from "./parse-qsf";
import type { TQsfSurvey } from "./types";

/**
 * Structured lane: Qualtrics QSF → v3 document, deterministically and without AI. Parse → map every
 * question → assemble pages into blocks → rewrite piped text → describe the logic. Logic is never
 * imported (D5); the report lists every rule so it can be rebuilt in the editor.
 */
export function convertQsfModel(model: TQsfSurvey): {
  document: Record<string, unknown> | null;
  issues: TImportIssue[];
  logicRulesReported: number;
} {
  const ctx = { defaultLanguageCode: model.defaultLanguageCode, languageCodes: model.languageCodes };
  const issues: TImportIssue[] = [...model.issues];

  // Hidden-field ids are claimed first so no element id can collide with them.
  const hiddenFieldIds = model.embeddedDataFields.map((field) => mapEmbeddedDataFieldName(field).fieldId);
  const idRegistry = new QsfIdRegistry(hiddenFieldIds);

  const mapped = new Map<string, TQsfQuestionMapping>();
  for (const [qid, question] of model.questions) {
    const mapping = mapQsfQuestion(question, { ...ctx, idRegistry });
    mapped.set(qid, mapping);
    issues.push(...mapping.issues);
  }

  const built = buildQsfDocument(model, mapped, ctx);
  issues.push(...built.issues);

  const logic = describeQsfLogic(model);
  issues.push(...logic.issues);

  if (!built.document) {
    return { document: null, issues, logicRulesReported: logic.count };
  }

  const declaredHiddenFieldIds = new Set(
    Array.isArray((built.document.hiddenFields as { fieldIds?: string[] } | undefined)?.fieldIds)
      ? ((built.document.hiddenFields as { fieldIds: string[] }).fieldIds ?? [])
      : []
  );
  issues.push(
    ...applyPipedTextToDocument(built.document, {
      qidToElementId: built.qidToElementId,
      hiddenFieldIds: declaredHiddenFieldIds,
    })
  );

  return { document: built.document, issues, logicRulesReported: logic.count };
}

export const qsfLane: TImportLaneHandler = async (input) => {
  const source: TImportReportSource = {
    lane: "structured",
    kind: "qsf",
    ...(input.fileName ? { fileName: input.fileName } : {}),
  };

  const raw =
    input.content.type === "bytes"
      ? input.content.bytes
      : input.content.type === "text"
        ? input.content.text
        : JSON.stringify(input.content.value);

  const parsed = parseQsf(raw);
  if (!parsed.ok) {
    return { document: null, issues: parsed.error, source };
  }

  const converted = convertQsfModel(parsed.data);
  const candidate: TImportCandidate = {
    document: hasFatalIssues(converted.issues) ? null : converted.document,
    issues: converted.issues,
    source,
    logicRulesReported: converted.logicRulesReported,
  };
  return candidate;
};
