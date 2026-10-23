import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import { isInternalI18nString, isPlainObject } from "./guards";
import {
  getV3SurveyIntroducedPrecedenceInvalidParams,
  getV3SurveyPrecedenceInvalidParams,
  validateV3SurveyReferences,
} from "./reference-validation";
import type { TV3SurveyDocument } from "./schemas";
import { V3_SURVEY_TRANSLATABLE_METADATA_KEYS } from "./translation-fields";

export type TV3SurveyDocumentValidationResult =
  | { valid: true; invalidParams: [] }
  | { valid: false; invalidParams: InvalidParam[] };

function getConfiguredTranslationLanguageCodes(document: TV3SurveyDocument): string[] {
  const defaultLanguage = document.defaultLanguage.toLowerCase();
  const languageCodes = new Set<string>();

  document.languages.forEach((language) => {
    const code = language.code;
    if (code.toLowerCase() !== defaultLanguage) {
      languageCodes.add(code);
    }
  });

  return Array.from(languageCodes.values());
}

function getDeclaredLanguageCodeSet(document: TV3SurveyDocument): Set<string> {
  return new Set([
    document.defaultLanguage.toLowerCase(),
    ...document.languages.map((language) => language.code.toLowerCase()),
  ]);
}

function addUnsupportedLocaleIssues(
  value: unknown,
  path: string,
  declaredLanguageCodes: Set<string>,
  issues: InvalidParam[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addUnsupportedLocaleIssues(
        entry,
        path ? `${path}.${index}` : String(index),
        declaredLanguageCodes,
        issues
      )
    );
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (isInternalI18nString(value)) {
    Object.keys(value).forEach((languageCode) => {
      if (languageCode !== "default" && !declaredLanguageCodes.has(languageCode.toLowerCase())) {
        issues.push({
          name: `${path}.${languageCode}`,
          reason: `Language '${languageCode}' must be declared in languages before it can be used in translatable content`,
          code: "unsupported_locale",
          identifier: languageCode,
          referenceType: "language",
        });
      }
    });
    return;
  }

  Object.entries(value).forEach(([key, entry]) =>
    addUnsupportedLocaleIssues(entry, path ? `${path}.${key}` : key, declaredLanguageCodes, issues)
  );
}

function addMissingTranslationIssues(
  value: unknown,
  path: string,
  languageCodes: string[],
  issues: InvalidParam[]
): void {
  if (languageCodes.length === 0) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addMissingTranslationIssues(entry, path ? `${path}.${index}` : String(index), languageCodes, issues)
    );
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  if (isInternalI18nString(value)) {
    languageCodes.forEach((languageCode) => {
      if (value[languageCode] === undefined) {
        issues.push({
          name: path,
          reason: `Translatable field is missing configured language '${languageCode}'`,
          code: "missing_translation",
          identifier: languageCode,
          referenceType: "language",
          missingId: languageCode,
        });
      }
    });
    return;
  }

  Object.entries(value).forEach(([key, entry]) =>
    addMissingTranslationIssues(entry, path ? `${path}.${key}` : key, languageCodes, issues)
  );
}

function getV3SurveyLanguageInvalidParams(document: TV3SurveyDocument): InvalidParam[] {
  const declaredLanguageCodes = getDeclaredLanguageCodeSet(document);
  const languageCodes = getConfiguredTranslationLanguageCodes(document);
  const issues: InvalidParam[] = [];

  if (isPlainObject(document.metadata)) {
    V3_SURVEY_TRANSLATABLE_METADATA_KEYS.forEach((key) =>
      addUnsupportedLocaleIssues(document.metadata[key], `metadata.${key}`, declaredLanguageCodes, issues)
    );
  }
  addUnsupportedLocaleIssues(document.welcomeCard, "welcomeCard", declaredLanguageCodes, issues);
  addUnsupportedLocaleIssues(document.blocks, "blocks", declaredLanguageCodes, issues);
  addUnsupportedLocaleIssues(document.endings, "endings", declaredLanguageCodes, issues);

  if (isPlainObject(document.metadata)) {
    V3_SURVEY_TRANSLATABLE_METADATA_KEYS.forEach((key) =>
      addMissingTranslationIssues(document.metadata[key], `metadata.${key}`, languageCodes, issues)
    );
  }
  addMissingTranslationIssues(document.welcomeCard, "welcomeCard", languageCodes, issues);
  addMissingTranslationIssues(document.blocks, "blocks", languageCodes, issues);
  addMissingTranslationIssues(document.endings, "endings", languageCodes, issues);

  return issues;
}

export function getV3SurveyMediaInvalidParams(blocks: TV3SurveyDocument["blocks"]): InvalidParam[] {
  const validation = checkForInvalidMediaInBlocks(blocks);

  if (validation.ok) {
    return [];
  }

  return [
    {
      name: "blocks",
      reason: validation.error.message,
    },
  ];
}

/** Every media URL the media check reads, in block/element order — what decides whether it can change. */
function getMediaFingerprint(blocks: ReadonlyArray<Pick<TSurveyBlock, "elements">>): string {
  return JSON.stringify(
    blocks.map((block) =>
      block.elements.map((element) => [
        element.imageUrl ?? null,
        element.videoUrl ?? null,
        "choices" in element && Array.isArray(element.choices)
          ? element.choices.map((choice) => ("imageUrl" in choice ? (choice.imageUrl ?? null) : null))
          : null,
      ])
    )
  );
}

/**
 * The media check for the patch family (ENG-3975): a survey whose stored media already fails it stays
 * patchable as long as the patch leaves every media URL where it was. Any media change is judged in full,
 * because the check reports only its first finding under `blocks` and cannot say which URL is new.
 */
export function getV3SurveyIntroducedMediaInvalidParams(
  blocks: TV3SurveyDocument["blocks"],
  baselineBlocks: ReadonlyArray<Pick<TSurveyBlock, "elements">>
): InvalidParam[] {
  if (getMediaFingerprint(blocks) === getMediaFingerprint(baselineBlocks)) {
    return [];
  }

  return getV3SurveyMediaInvalidParams(blocks);
}

/**
 * How strictly to apply the ordering rules (ENG-3069).
 *
 * `introduced` on the patch family (PATCH, block edit, reorder): only what the change adds is reported —
 * enforcing the full set would make a survey that already contains a forward recall unpatchable,
 * including by a request that never touches it. `skip` on create, which accepted these documents before
 * the rule existed (see `prepareV3SurveyCreate` for why that stays). `enforce` is kept for the rollout
 * that tightens create and is reached by no production caller today. The parameter is required rather
 * than defaulted so a new caller has to choose.
 */
export type TV3SurveyPrecedencePolicy =
  | { mode: "enforce" }
  | { mode: "introduced"; baseline: TV3SurveyDocument }
  | { mode: "skip" };

/**
 * ENG-3946: the steps of a respondent's path that lie on a loop, as `from→to` block keys. A step is a
 * `jumpToBlock` target, the logic fallback, or the next block — the same edges `surveyRefinement`'s
 * cycle check follows, so this agrees with create and the editor on what loops.
 *
 * Edges rather than blocks: a block that only *leads into* a loop is not on it, and a second loop between
 * blocks that already loop is still new. Comparing flagged block ids gets both wrong.
 */
function getCyclicFlowEdges(documentBlocks: TV3SurveyDocument["blocks"]): Map<string, number> {
  const blocks = documentBlocks as TSurveyBlock[];
  const keys = blocks.map((block, index) => block.id ?? `#${String(index)}`);
  const indexByKey = new Map(keys.map((key, index) => [key, index]));

  const successors = blocks.map((block, index) => {
    const targets = new Set<number>();
    const add = (key: string | undefined) => {
      const target = key === undefined ? undefined : indexByKey.get(key);
      if (target !== undefined) targets.add(target);
    };
    block.logic?.forEach((logic) =>
      logic.actions.forEach((action) => {
        if (action.objective === "jumpToBlock") add(action.target);
      })
    );
    add(block.logicFallback);
    if (index + 1 < blocks.length) targets.add(index + 1);
    return [...targets];
  });

  // Tarjan's strongly connected components: an edge lies on a loop exactly when both ends share one.
  const order: number[] = new Array(blocks.length).fill(-1);
  const low: number[] = new Array(blocks.length).fill(0);
  const component: number[] = new Array(blocks.length).fill(-1);
  const stack: number[] = [];
  const onStack: boolean[] = new Array(blocks.length).fill(false);
  let visited = 0;
  let components = 0;

  const connect = (node: number): void => {
    order[node] = visited;
    low[node] = visited;
    visited += 1;
    stack.push(node);
    onStack[node] = true;

    for (const next of successors[node]) {
      if (order[next] === -1) {
        connect(next);
        low[node] = Math.min(low[node], low[next]);
      } else if (onStack[next]) {
        low[node] = Math.min(low[node], order[next]);
      }
    }

    if (low[node] === order[node]) {
      let member: number | undefined;
      do {
        member = stack.pop() as number;
        onStack[member] = false;
        component[member] = components;
      } while (member !== node);
      components += 1;
    }
  };

  blocks.forEach((_, index) => {
    if (order[index] === -1) connect(index);
  });

  // Keyed by edge, valued by the index of the block it leaves — the block whose logic the caller fixes.
  const edges = new Map<string, number>();
  successors.forEach((targets, from) =>
    targets.forEach((to) => {
      if (component[from] === component[to]) edges.set(`${keys[from]}→${keys[to]}`, from);
    })
  );
  return edges;
}

/**
 * The loops to report under `precedence`, one param per block a looping step leaves. Create already
 * refuses every loop through the survey service's own write schema, which the patch family never runs —
 * so without this a reorder or a block edit stored a survey the editor then refuses to save. Same
 * message as that refinement, so a caller sees one wording whichever path caught it.
 *
 * `introduced` compares edges before and after, like the ordering rule: a survey that already loops
 * stays patchable by a request that leaves the loop alone, a request that removes it is accepted, and
 * one that adds a loop — even between blocks already on another — is refused. `skip` reports nothing,
 * because create's write schema already rejects every loop and would list each one twice.
 */
function getV3SurveyCyclicLogicInvalidParams(
  documentBlocks: TV3SurveyDocument["blocks"],
  precedence: TV3SurveyPrecedencePolicy
): InvalidParam[] {
  if (precedence.mode === "skip") {
    return [];
  }

  const edges = getCyclicFlowEdges(documentBlocks);
  const existing =
    precedence.mode === "introduced" ? getCyclicFlowEdges(precedence.baseline.blocks) : new Map();

  const offendingIndexes = new Set<number>();
  edges.forEach((from, edge) => {
    if (!existing.has(edge)) offendingIndexes.add(from);
  });

  return [...offendingIndexes]
    .sort((a, b) => a - b)
    .map((index) => ({
      name: `blocks.${String(index)}.logic`,
      reason: `Conditional Logic: Cyclic logic detected in block ${String(index + 1)} (${documentBlocks[index].name}).`,
    }));
}

function toReferenceInput(document: TV3SurveyDocument) {
  return {
    blocks: document.blocks,
    endings: document.endings,
    hiddenFields: document.hiddenFields,
    metadata: document.metadata,
    variables: document.variables,
    welcomeCard: document.welcomeCard,
  };
}

export function validateV3SurveyDocument(
  document: TV3SurveyDocument,
  precedence: TV3SurveyPrecedencePolicy
): TV3SurveyDocumentValidationResult {
  const languageInvalidParams = getV3SurveyLanguageInvalidParams(document);
  const mediaInvalidParams =
    precedence.mode === "introduced"
      ? getV3SurveyIntroducedMediaInvalidParams(document.blocks, precedence.baseline.blocks)
      : getV3SurveyMediaInvalidParams(document.blocks);
  const invalidParams = [...languageInvalidParams, ...mediaInvalidParams];

  const referenceInput = toReferenceInput(document);
  const referenceValidation = validateV3SurveyReferences(referenceInput);

  if (!referenceValidation.ok) {
    invalidParams.push(...referenceValidation.invalidParams);
  }

  if (precedence.mode === "enforce") {
    invalidParams.push(...getV3SurveyPrecedenceInvalidParams(referenceInput));
  } else if (precedence.mode === "introduced") {
    invalidParams.push(
      ...getV3SurveyIntroducedPrecedenceInvalidParams(toReferenceInput(precedence.baseline), referenceInput)
    );
  }

  invalidParams.push(...getV3SurveyCyclicLogicInvalidParams(document.blocks, precedence));

  if (invalidParams.length > 0) {
    return {
      valid: false,
      invalidParams,
    };
  }

  return { valid: true, invalidParams: [] };
}
