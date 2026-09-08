import "server-only";
import {
  type TGeneratedDraftLike,
  V3_SURVEY_GENERATE_ALLOWED_LOCALES,
} from "@/app/api/v3/surveys/generate/schemas";
import { buildV3SurveyCreatePayloadFromDraft } from "@/app/api/v3/surveys/generate/service";
import { hasFatalIssues, importError, importInfo, importWarning } from "../../report";
import type {
  TImportCandidate,
  TImportContext,
  TImportIssue,
  TImportLaneHandler,
  TImportLaneInput,
  TImportReportSource,
} from "../../types";
import { type TChunk, chunkDocumentText } from "./chunk";
import {
  allowedLanguageCodes,
  detectDocumentLanguages,
  languageAmbiguityIssue,
  normalizeDetectedLanguageCode,
} from "./detect-languages";
import { extractDocumentText } from "./extract";
import {
  type TExtractedSurveyDraft,
  createImportDraftSchema,
  extractSurveyDraft,
  streamSurveyDraft,
} from "./extract-survey";

/** Detection reads at most this much; enough to name the languages of any questionnaire. */
const LANGUAGE_DETECTION_INPUT_CHARS = 20_000;

function toBuffer(input: TImportLaneInput): Buffer {
  const { content } = input;
  if (content.type === "bytes") return content.bytes;
  if (content.type === "text") return Buffer.from(content.text, "utf8");
  return Buffer.from(JSON.stringify(content.value), "utf8");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("The import was aborted", "AbortError");
  }
}

/**
 * Blocks concatenated in order; `welcomeCard` from the first chunk, `ending` from the last, `name` from
 * the first non-empty one. Notes were already turned into issues, so they are dropped here.
 */
export function mergeDrafts(drafts: TGeneratedDraftLike[]): TGeneratedDraftLike {
  const first = drafts[0];
  const last = drafts[drafts.length - 1];
  const named = drafts.find(
    (draft) => (typeof draft.name === "string" ? draft.name.trim().length : draft.name.length) > 0
  );

  return {
    language: first.language,
    ...(first.defaultLanguage ? { defaultLanguage: first.defaultLanguage } : {}),
    name: (named ?? first).name,
    description: (named ?? first).description ?? null,
    welcomeCard: first.welcomeCard ?? null,
    ending: last.ending ?? null,
    blocks: drafts.flatMap((draft) => draft.blocks),
  };
}

type TChunkOutcome = { draft: TGeneratedDraftLike | null; issues: TImportIssue[]; languageCodes: string[] };

async function extractChunk(
  chunk: TChunk,
  params: {
    languageCodes: string[];
    defaultLanguageCode: string;
    ctx: TImportContext;
    blockOffset: number;
  }
): Promise<TExtractedSurveyDraft> {
  const { ctx } = params;
  const request = {
    text: chunk.text,
    languageCodes: params.languageCodes,
    defaultLanguageCode: params.defaultLanguageCode,
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    part: chunk.total > 1 ? { index: chunk.index, total: chunk.total } : undefined,
    signal: ctx.signal,
  };

  if (!ctx.onPartial) {
    return extractSurveyDraft(request);
  }

  const streamed = await streamSurveyDraft(request);
  for await (const partial of streamed.partialObjectStream) {
    ctx.onPartial(partial, params.blockOffset);
  }
  return streamed.completion;
}

/**
 * AI lane: document → text → languages → chunks → drafts → one v3 document. Sequential per chunk so a
 * failure in chunk k keeps chunks 1..k-1 (reported as `chunk_failed`); a failure before anything was
 * extracted propagates so the route can map the provider error.
 */
export const documentLane: TImportLaneHandler = async (input, ctx) => {
  const source: TImportReportSource = {
    lane: "ai",
    kind: input.kind,
    ...(input.fileName ? { fileName: input.fileName } : {}),
  };

  ctx.onProgress?.({ stage: "reading" });
  const extracted = await extractDocumentText(input.kind, toBuffer(input));
  const issues: TImportIssue[] = [...extracted.issues];
  if (hasFatalIssues(issues) || extracted.text.length === 0) {
    return {
      document: null,
      issues: issues.length > 0 ? issues : [importError({ code: "no_text_extracted" })],
      source,
    };
  }

  throwIfAborted(ctx.signal);
  ctx.onProgress?.({ stage: "detecting_languages" });
  const detection = await detectDocumentLanguages({
    text: extracted.text.slice(0, LANGUAGE_DETECTION_INPUT_CHARS),
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    languageHint: ctx.languageHint,
    signal: ctx.signal,
  });

  const hint = normalizeDetectedLanguageCode(ctx.languageHint) ?? "en-US";
  let languageCodes: string[];
  let defaultLanguageCode: string;
  if (detection) {
    languageCodes = allowedLanguageCodes(detection);
    defaultLanguageCode = detection.primaryLanguageCode;
    source.detectedLanguages = detection.languages.map(({ code, confidence }) => ({ code, confidence }));
    const ambiguity = languageAmbiguityIssue(detection);
    if (ambiguity) issues.push(ambiguity);
  } else {
    // Short document: no detection call. The workspace hint leads; the app's locales are the fallback set.
    languageCodes = [...new Set([hint, ...V3_SURVEY_GENERATE_ALLOWED_LOCALES])];
    defaultLanguageCode = hint;
  }

  const chunked = chunkDocumentText(extracted.text, { languageCount: languageCodes.length });
  issues.push(...chunked.issues);
  if (chunked.chunks.length === 0) {
    return { document: null, issues: [...issues, importError({ code: "nothing_extracted" })], source };
  }

  const drafts: TGeneratedDraftLike[] = [];
  const usedLanguageCodes = new Set<string>([defaultLanguageCode]);
  let blockOffset = 0;
  let calls = 0;

  for (const chunk of chunked.chunks) {
    throwIfAborted(ctx.signal);
    ctx.onProgress?.({ stage: "extracting", chunk: { index: chunk.index, total: chunk.total } });

    let outcome: TChunkOutcome;
    try {
      calls += 1;
      const result = await extractChunk(chunk, { languageCodes, defaultLanguageCode, ctx, blockOffset });
      outcome = { draft: result.draft, issues: result.issues, languageCodes: result.languageCodes };
      if (drafts.length === 0 && result.defaultLanguageCode !== defaultLanguageCode) {
        defaultLanguageCode = result.defaultLanguageCode;
        usedLanguageCodes.add(defaultLanguageCode);
      }
    } catch (error) {
      if (drafts.length === 0) throw error;
      issues.push(importWarning({ code: "chunk_failed", vars: { index: chunk.index, total: chunk.total } }));
      continue;
    }

    if (!outcome.draft) {
      // Nothing in this chunk: fatal only when no other chunk delivered anything (decided at the end).
      if (chunk.total === 1) issues.push(...outcome.issues);
      continue;
    }

    issues.push(...outcome.issues);
    for (const code of outcome.languageCodes) usedLanguageCodes.add(code);
    drafts.push(outcome.draft);
    blockOffset += outcome.draft.blocks.length;
  }

  source.chunks = calls;
  if (drafts.length === 0) {
    return {
      document: null,
      issues: hasFatalIssues(issues) ? issues : [...issues, importError({ code: "nothing_extracted" })],
      source,
    };
  }
  if (chunked.chunks.length > 1) {
    issues.push(importInfo({ code: "chunked", vars: { count: chunked.chunks.length } }));
  }

  ctx.onProgress?.({ stage: "validating" });
  const codes = [
    defaultLanguageCode,
    ...[...usedLanguageCodes].filter((code) => code !== defaultLanguageCode),
  ];
  const built = buildV3SurveyCreatePayloadFromDraft(
    { workspaceId: ctx.workspaceId, type: "link" },
    mergeDrafts(drafts),
    {
      schema: createImportDraftSchema(codes, { chunks: drafts.length }).internal,
      languages: { defaultLanguage: defaultLanguageCode, codes },
    }
  );
  for (const fill of built.translationFills) {
    issues.push(
      importWarning({
        code: "translation_filled",
        path: fill.path,
        vars: { code: fill.languageCode, path: fill.path },
      })
    );
  }

  const { workspaceId: _workspaceId, ...document } = built.payload;
  const candidate: TImportCandidate = { document, issues, source };
  return candidate;
};
