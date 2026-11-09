import { SURVEY_IMPORT_MAX_DRAFT_BYTES } from "../limits";
import type { TSurveyImportAssembly, TSurveyImportDraft } from "./draft";
import { withLanguageSettings } from "./language-settings";
import type { TSurveyImportPipelineIssue } from "./report";

/**
 * Fit the draft to the create's body limit (ENG-3654). The dialog sends the draft back to be created
 * as `JSON.stringify(payload)`, and the survey it becomes is written under the v3 survey body cap,
 * `DEFAULT_REQUEST_BODY_LIMIT_BYTES` (`SURVEY_IMPORT_MAX_DRAFT_BYTES`): an import that ends `done` with
 * a larger draft would only fail when the user creates or saves it. So, strip and warn (ENG-3411): languages go first, last declared first,
 * then trailing questions — later questions are the safe ones to cut, since recall only points back.
 */

const encoder = new TextEncoder();
/** UTF-8 bytes, as the request body carries them. */
const byteLength = (text: string): number => encoder.encode(text).length;
/** The UTF-8 bytes of a value as JSON. */
export const jsonBytes = (value: unknown): number => byteLength(JSON.stringify(value));

/** The bytes the create's request body takes for this draft. */
export const measureDraftBytes = (document: TSurveyImportDraft): number => jsonBytes(document);

/** The label the file gives a source question, for report lines (`questionTag`). */
export type TQuestionLabel = (questionRef: string) => string | undefined;

type TLocaleText = Record<string, string>;

/**
 * Every locale-keyed text in the draft: an object holding the default language's key, all of whose
 * keys are survey languages and all of whose values are strings. v3 requires every text to carry the
 * default language, and no other part of the draft is keyed by language codes.
 */
function collectLocaleTexts(
  document: TSurveyImportDraft,
  roots: unknown[] = [document.welcomeCard, document.blocks, document.endings]
): TLocaleText[] {
  const codes = new Set(document.languages.map((language) => language.code));
  const texts: TLocaleText[] = [];
  const stack: unknown[] = [...roots];
  for (let value = stack.pop(); value !== undefined; value = stack.pop()) {
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    const entries = Object.entries(value);
    const isLocaleText =
      Object.hasOwn(value, document.defaultLanguage) &&
      entries.every(([key, text]) => codes.has(key) && typeof text === "string");
    if (isLocaleText) texts.push(value as TLocaleText);
    else for (const [, child] of entries) stack.push(child);
  }
  return texts;
}

/**
 * Drop non-default languages, last declared first, until the draft fits. Each language's weight is
 * summed once — `,"code":"text"` in every text, and its entry in `languages` — so no step serializes
 * the draft again.
 */
function dropLanguages(
  document: TSurveyImportDraft,
  overBy: number,
  issues: TSurveyImportPipelineIssue[]
): number {
  const droppable = document.languages.filter((language) => !language.default);
  if (droppable.length === 0) return overBy;

  const texts = collectLocaleTexts(document);
  const weight = new Map<string, number>(
    document.languages.map((language) => [language.code, jsonBytes(language) + 1])
  );
  for (const text of texts) {
    for (const [code, value] of Object.entries(text)) {
      if (code === document.defaultLanguage) continue;
      weight.set(code, (weight.get(code) ?? 0) + byteLength(JSON.stringify(code)) + jsonBytes(value) + 2);
    }
  }

  const dropped = new Set<string>();
  let remaining = overBy;
  for (const language of droppable.toReversed()) {
    if (remaining <= 0) break;
    dropped.add(language.code);
    remaining -= weight.get(language.code) ?? 0;
    issues.push({
      code: "language_skipped",
      severity: "warning",
      params: { code: language.code, cause: "draft_too_large", order: "last_declared_first" },
    });
  }

  document.languages = document.languages.filter((language) => !dropped.has(language.code));
  for (const text of texts) for (const code of dropped) delete text[code];
  withLanguageSettings(document);
  return remaining;
}

/**
 * A jump to a block the cut removed is a jump to the end. The block was the last one when it was cut,
 * so jumping to it and continuing past it end the same way; retargeting keeps the rule — and the
 * report line that names it — instead of leaving the create to refuse a jump to a block that is gone.
 */
const retargetJumpsToCutBlocks = (document: TSurveyImportDraft, cutBlockIds: ReadonlySet<string>): void => {
  if (cutBlockIds.size === 0) return;
  const endingId = document.endings[0]?.id;

  for (const block of document.blocks) {
    if (block.logic) {
      block.logic = block.logic.flatMap((rule) => {
        const actions = rule.actions.flatMap((action) => {
          if (action.objective !== "jumpToBlock" || !cutBlockIds.has(action.target)) return [action];
          return endingId ? [{ ...action, target: endingId }] : [];
        });
        return actions.length > 0 ? [{ ...rule, actions }] : [];
      });
      if (block.logic.length === 0) delete block.logic;
    }
    if (block.logicFallback !== undefined && cutBlockIds.has(block.logicFallback)) {
      if (endingId) block.logicFallback = endingId;
      else delete block.logicFallback;
    }
  }
};

/** Whether a rule's conditions read any of the elements: an operand `{ type: "element", value }`. */
const readsAnyElement = (value: unknown, elementIds: ReadonlySet<string>): boolean => {
  if (Array.isArray(value)) return value.some((item) => readsAnyElement(item, elementIds));
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.type === "element" && typeof record.value === "string" && elementIds.has(record.value)) {
    return true;
  }
  return Object.values(record).some((item) => readsAnyElement(item, elementIds));
};

/**
 * The rules of cut questions go with them. A rule that reads a cut question must: a jump can test its
 * own question, which may be the one cut from a block that is kept, and the create refuses the draft
 * otherwise. So does a rule written for questions that were all cut, though it reads one that stays,
 * as its report lines go (`keepIssue`); everything after a cut question is cut, so its jump changed
 * nothing. A block left with no rule loses its fallback, which only ever stands beside rules: alone it
 * would jump every time, and the create refuses it.
 */
const dropRulesOfCutQuestions = (
  { document, ruleOwners }: TSurveyImportAssembly,
  cut: { elementIds: ReadonlySet<string>; refs: ReadonlySet<string> }
): void => {
  const ownedByCut = (ruleId: string) => {
    const owners = ruleOwners?.get(ruleId);
    return owners !== undefined && owners.length > 0 && owners.every((ref) => cut.refs.has(ref));
  };
  for (const block of document.blocks) {
    if (!block.logic) continue;
    block.logic = block.logic.filter(
      (rule) => !readsAnyElement(rule.conditions, cut.elementIds) && !ownedByCut(rule.id)
    );
    if (block.logic.length === 0) {
      delete block.logic;
      delete block.logicFallback;
    }
  }
};

/** The report line for a question cut to fit the draft, named by its label where the lane has one. */
const cutForSize = (
  elementId: string,
  ref: string | undefined,
  questionLabel: TQuestionLabel
): TSurveyImportPipelineIssue => {
  if (!ref) {
    return {
      code: "question_skipped",
      severity: "warning",
      questionTag: elementId,
      params: { cause: "draft_too_large" },
    };
  }
  return {
    code: "question_skipped",
    severity: "warning",
    questionTag: questionLabel(ref) ?? elementId,
    questionRef: ref,
    params: { cause: "draft_too_large" },
  };
};

/**
 * Drop trailing questions, and a block once it empties, until the draft fits. Each step weighs only
 * what it removes: the element and its comma, or the emptied block and its comma.
 */
function dropTrailingQuestions(
  assembly: TSurveyImportAssembly,
  questionLabel: TQuestionLabel,
  overBy: number,
  issues: TSurveyImportPipelineIssue[]
): { refs: Set<string>; elementIds: Set<string> } {
  const { document, elementRefs } = assembly;
  /** The questions cut, by the lane's own id: labels can repeat. */
  const droppedRefs = new Set<string>();
  const elementIds = new Set<string>();
  const cutBlockIds = new Set<string>();
  let remaining = overBy;

  while (remaining > 0 && document.blocks.length > 0) {
    const blockIndex = document.blocks.length - 1;
    const block = document.blocks[blockIndex];
    const element = block.elements.pop();
    const ref = elementRefs[blockIndex]?.pop();
    if (element) {
      // The element, and the comma before it when one is left in front.
      remaining -= jsonBytes(element) + Math.min(block.elements.length, 1);
      if (ref) droppedRefs.add(ref);
      elementIds.add(element.id);
      issues.push(cutForSize(element.id, ref, questionLabel));
    }
    if (block.elements.length === 0) {
      remaining -= jsonBytes(block) + Math.min(document.blocks.length - 1, 1);
      cutBlockIds.add(block.id);
      document.blocks.pop();
      elementRefs.pop();
    }
  }
  retargetJumpsToCutBlocks(document, cutBlockIds);
  return { refs: droppedRefs, elementIds };
}

/** A recall token as the import writes it, and as the editor reads it. */
const RECALL_TOKEN = /#recall:([A-Za-z0-9_-]+)\/fallback:([^#]*)#/g;

/**
 * Recalls of cut questions, wherever the draft still has them — an ending may recall any question —
 * replaced by their fallback text, with one `piped_text_removed` line per element or ending holding
 * any. Left in, the create refuses the draft: a recall must name a question it has.
 */
function replaceRecallsOf(
  assembly: TSurveyImportAssembly,
  questionLabel: TQuestionLabel,
  cutIds: ReadonlySet<string>,
  issues: TSurveyImportPipelineIssue[]
): void {
  const { document, elementRefs } = assembly;
  const replaceIn = (root: unknown): number => {
    let replaced = 0;
    for (const text of collectLocaleTexts(document, [root])) {
      for (const [code, value] of Object.entries(text)) {
        if (!value.includes("#recall:")) continue;
        text[code] = value.replaceAll(RECALL_TOKEN, (token: string, id: string, fallback: string) => {
          if (!cutIds.has(id)) return token;
          replaced += 1;
          return fallback;
        });
      }
    }
    return replaced;
  };

  document.blocks.forEach((block, blockIndex) => {
    block.elements.forEach((element, elementIndex) => {
      const count = replaceIn(element);
      if (count === 0) return;
      const ref = elementRefs[blockIndex]?.[elementIndex];
      issues.push({
        code: "piped_text_removed",
        severity: "warning",
        questionTag: (ref ? questionLabel(ref) : undefined) ?? element.id,
        ...(ref ? { questionRef: ref } : {}),
        params: { count },
      });
    });
  });
  const inEndings = replaceIn(document.endings);
  if (inEndings > 0) {
    issues.push({ code: "piped_text_removed", severity: "warning", params: { count: inEndings } });
  }
}

/**
 * Cut the assembly in place to fit `maxBytes`, and say what was cut. `keepIssue` filters the earlier
 * report lines: those about a cut language's fallbacks or a cut question go with them, so the report
 * describes the draft. An assembly that fits is left as it is. The caller fails the import if no
 * question is left.
 */
export function fitDraftToCreateLimit(
  assembly: TSurveyImportAssembly,
  questionLabel: TQuestionLabel,
  maxBytes: number = SURVEY_IMPORT_MAX_DRAFT_BYTES
): { dropped: TSurveyImportPipelineIssue[]; keepIssue: (issue: TSurveyImportPipelineIssue) => boolean } {
  let overBy = measureDraftBytes(assembly.document) - maxBytes;
  if (overBy <= 0) return { dropped: [], keepIssue: () => true };

  const dropped: TSurveyImportPipelineIssue[] = [];
  const languagesBefore = assembly.document.languages.map((language) => language.code);
  const droppedRefs = new Set<string>();
  const cutElementIds = new Set<string>();

  // The weights are exact, but the result is measured again rather than trusted, and cut further if
  // it is still over.
  while (overBy > 0 && assembly.document.blocks.length > 0) {
    overBy = dropLanguages(assembly.document, overBy, dropped);
    if (overBy > 0) {
      const cut = dropTrailingQuestions(assembly, questionLabel, overBy, dropped);
      cut.refs.forEach((ref) => droppedRefs.add(ref));
      cut.elementIds.forEach((id) => cutElementIds.add(id));
      dropRulesOfCutQuestions(assembly, { elementIds: cutElementIds, refs: droppedRefs });
      replaceRecallsOf(assembly, questionLabel, cut.elementIds, dropped);
    }
    overBy = measureDraftBytes(assembly.document) - maxBytes;
  }

  const kept = new Set(assembly.document.languages.map((language) => language.code));
  const droppedLanguages = new Set(languagesBefore.filter((code) => !kept.has(code)));
  const keepIssue = (issue: TSurveyImportPipelineIssue) =>
    !(issue.code === "translation_missing" && droppedLanguages.has(String(issue.params?.language))) &&
    !(issue.questionRef !== undefined && droppedRefs.has(issue.questionRef));
  return { dropped, keepIssue };
}
