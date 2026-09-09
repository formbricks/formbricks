import { createId } from "@paralleldrive/cuid2";
import { createZV3TypedSurveyDocumentSchema, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { importError, importInfo, importWarning } from "../../report";
import type { TImportIssue } from "../../types";
import { mapEmbeddedDataFieldName } from "./embedded-data";
import type { TQsfI18n, TQsfMappedElement, TQsfQuestionMapping } from "./map-question";
import { stripHtml } from "./strip-html";
import type { TQsfBlock, TQsfFlowNode, TQsfSurvey } from "./types";

export type TQsfStructureContext = {
  defaultLanguageCode: string;
  languageCodes: readonly string[];
};

export type TQsfDocumentBuild = {
  /** The v3 document candidate (public shape), or `null` when it does not validate. */
  document: Record<string, unknown> | null;
  issues: TImportIssue[];
  qidToBlockId: Map<string, string>;
  qidToElementId: Map<string, string>;
  /** The single ending every `EndSurvey` node points at. */
  endingId: string;
};

type TPage = { blockId: string; description: string; pageIndex: number; pageCount: number; qids: string[] };

// Same fallback copy the AI lanes use, so the lanes agree on what an unnamed ending says.
const DEFAULT_ENDING_HEADLINE = "Thanks for your feedback";

function text(value: string, ctx: TQsfStructureContext): TQsfI18n {
  const map: TQsfI18n = { [ctx.defaultLanguageCode]: value };
  for (const code of ctx.languageCodes) map[code] = value;
  return map;
}

function pagesOf(block: TQsfBlock): TPage[] {
  const pages: string[][] = [[]];
  for (const element of block.elements) {
    if (element.kind === "pageBreak") pages.push([]);
    else pages.at(-1)!.push(element.qid);
  }
  const nonEmpty = pages.filter((page) => page.length > 0);
  return nonEmpty.map((qids, index) => ({
    blockId: block.id,
    description: block.description,
    pageIndex: index + 1,
    pageCount: nonEmpty.length,
    qids,
  }));
}

/** Depth-first flow walk: the order Qualtrics shows blocks in, randomizers and branches flattened. */
function collectFlowBlockIds(nodes: TQsfFlowNode[], into: string[], issues: TImportIssue[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case "Block":
      case "Standard":
        if (!into.includes(node.id)) into.push(node.id);
        break;
      case "BlockRandomizer":
      case "Randomizer":
        issues.push(importWarning({ code: "randomizer_flattened", sourceRef: "Survey Flow" }));
        collectFlowBlockIds(node.children, into, issues);
        break;
      case "Branch":
      case "Group":
        collectFlowBlockIds(node.children, into, issues);
        break;
      default:
        break;
    }
  }
}

function blockName(page: TPage, position: number): string {
  const base = page.description.trim() || `Block ${position}`;
  return page.pageCount > 1 ? `${base} · Page ${page.pageIndex}` : base;
}

function buildEnding(
  model: TQsfSurvey,
  ctx: TQsfStructureContext,
  endingId: string
): Record<string, unknown> {
  if (model.options.eosRedirectUrl) {
    return {
      id: endingId,
      type: "redirectToUrl",
      url: model.options.eosRedirectUrl,
      label: DEFAULT_ENDING_HEADLINE,
    };
  }
  const headline = model.options.eosMessage ? stripHtml(model.options.eosMessage) : "";
  return {
    id: endingId,
    type: "endScreen",
    headline: text(headline.length > 0 ? headline : DEFAULT_ENDING_HEADLINE, ctx),
  };
}

function buildHiddenFields(model: TQsfSurvey, issues: TImportIssue[]): Record<string, unknown> {
  const fieldIds: string[] = [];
  for (const source of model.embeddedDataFields) {
    const mapping = mapEmbeddedDataFieldName(source);
    if (fieldIds.includes(mapping.fieldId)) continue;
    fieldIds.push(mapping.fieldId);
    if (mapping.refused) {
      issues.push(
        importWarning({
          code: "embedded_data_name_refused",
          sourceRef: "Embedded Data",
          vars: { name: source, renamed: mapping.fieldId },
        })
      );
    } else if (mapping.renamed) {
      issues.push(
        importInfo({
          code: "field_renamed",
          sourceRef: "Embedded Data",
          vars: { from: source, to: mapping.fieldId },
        })
      );
    }
  }
  return fieldIds.length > 0 ? { enabled: true, fieldIds } : { enabled: false };
}

/**
 * Assemble mapped questions into a v3 survey document: one Formbricks block per Qualtrics page (D5),
 * in flow order, with a single ending, the welcome card from a leading descriptive text, button labels
 * from the survey options, every language declared, and embedded data as hidden fields.
 */
export function buildQsfDocument(
  model: TQsfSurvey,
  mapped: Map<string, TQsfQuestionMapping>,
  ctx: TQsfStructureContext
): TQsfDocumentBuild {
  const issues: TImportIssue[] = [];
  const qidToBlockId = new Map<string, string>();
  const qidToElementId = new Map<string, string>();
  const endingId = createId();

  const flowBlockIds: string[] = [];
  collectFlowBlockIds(model.flow, flowBlockIds, issues);

  const blocksById = new Map(model.blocks.map((block) => [block.id, block]));
  const orderedBlocks: TQsfBlock[] = flowBlockIds
    .map((id) => blocksById.get(id))
    .filter((block): block is TQsfBlock => block !== undefined && block.type !== "Trash");
  for (const block of model.blocks) {
    if (block.type === "Trash" || orderedBlocks.includes(block)) continue;
    orderedBlocks.push(block);
    issues.push(
      importInfo({
        code: "block_not_in_flow",
        sourceRef: block.id,
        vars: { block: block.description || block.id },
      })
    );
  }

  const pages = orderedBlocks.flatMap(pagesOf);
  const blocks: Record<string, unknown>[] = [];
  let welcomeCard: Record<string, unknown> = { enabled: false };
  let isFirstElement = true;

  for (const page of pages) {
    const blockId = createId();
    const elements: TQsfMappedElement[] = [];

    for (const qid of page.qids) {
      const mapping = mapped.get(qid);
      if (!mapping || mapping.elements.length === 0) continue;

      const question = model.questions.get(qid);
      if (isFirstElement && question?.type === "DB" && mapping.elements.length === 1) {
        // A leading descriptive text is the welcome card, not a question.
        const cta = mapping.elements[0];
        welcomeCard = {
          enabled: true,
          headline: cta.headline,
          ...(cta.subheader ? { subheader: cta.subheader } : {}),
          buttonLabel: text("Start", ctx),
          timeToFinish: false,
          showResponseCount: false,
        };
        issues.push(importInfo({ code: "welcome_card_from_descriptive_text", sourceRef: qid }));
        isFirstElement = false;
        continue;
      }
      isFirstElement = false;

      qidToBlockId.set(qid, blockId);
      qidToElementId.set(qid, mapping.elements[0].id);
      elements.push(...mapping.elements);
    }

    if (elements.length === 0) continue;

    blocks.push({
      id: blockId,
      name: blockName(page, blocks.length + 1),
      elements,
      ...(model.options.nextButtonLabel ? { buttonLabel: text(model.options.nextButtonLabel, ctx) } : {}),
      ...(model.options.previousButtonLabel
        ? { backButtonLabel: text(model.options.previousButtonLabel, ctx) }
        : {}),
    });
  }

  // Qualtrics' BackButton is not reported: the v3 create document carries no back-button field, and the
  // editor's default (button shown) is the common case. The progress bar has no counterpart at all.
  if (model.options.progressBar && model.options.progressBar !== "None") {
    issues.push(
      importInfo({
        code: "setting_not_imported",
        sourceRef: "Survey Options",
        vars: { setting: "ProgressBarDisplay" },
      })
    );
  }

  const name = model.name.trim() || "Imported Qualtrics survey";
  const document: Record<string, unknown> = {
    name,
    type: "link",
    status: "draft",
    metadata: { title: text(name, ctx) },
    defaultLanguage: ctx.defaultLanguageCode,
    languages: [
      { code: ctx.defaultLanguageCode, default: true, enabled: true },
      ...ctx.languageCodes.map((code) => ({ code, default: false, enabled: true })),
    ],
    welcomeCard,
    blocks,
    endings: [buildEnding(model, ctx, endingId)],
    hiddenFields: buildHiddenFields(model, issues),
    variables: [],
  };

  if (blocks.length === 0) {
    issues.push(
      importError({
        code: "nothing_extracted",
        message: "No questions in this Qualtrics file could be imported.",
      })
    );
    return { document: null, issues, qidToBlockId, qidToElementId, endingId };
  }

  const parsed = createZV3TypedSurveyDocumentSchema().safeParse(document);
  if (!parsed.success) {
    for (const param of formatV3ZodInvalidParams(parsed.error, "survey")) {
      issues.push(
        importError({
          code: "invalid_document",
          path: param.name,
          message: param.reason,
          vars: { detail: param.reason },
        })
      );
    }
    return { document: null, issues, qidToBlockId, qidToElementId, endingId };
  }

  return { document, issues, qidToBlockId, qidToElementId, endingId };
}
