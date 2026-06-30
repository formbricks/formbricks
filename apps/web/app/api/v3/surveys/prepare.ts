import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { surveyToV3Distribution, surveyToV3Targeting } from "./distribution";
import { getV3SurveyDefaultLanguage, getV3SurveyLanguages } from "./language";
import { type TV3SurveyLanguageRequest, deriveV3SurveyLanguageRequests } from "./languages";
import {
  DEFAULT_V3_SURVEY_LANGUAGE,
  type TV3CreateSurveyBody,
  type TV3PatchSurveyBody,
  type TV3SurveyDocument,
  ZV3CreateSurveyBody,
  createZV3PatchSurveyBodySchema,
  createZV3SurveyDocumentBaseSchema,
  formatV3ZodInvalidParams,
} from "./schemas";
import { type TV3SurveyDocumentValidationResult, validateV3SurveyDocument } from "./validation";

type TV3SurveyPrepareSuccess<TDocument> = {
  ok: true;
  document: TDocument;
  validation: Extract<TV3SurveyDocumentValidationResult, { valid: true }>;
  languageRequests: TV3SurveyLanguageRequest[];
};

type TV3SurveyPrepareFailure = {
  ok: false;
  validation: Extract<TV3SurveyDocumentValidationResult, { valid: false }>;
};

export type TV3SurveyPrepareResult<TDocument> = TV3SurveyPrepareSuccess<TDocument> | TV3SurveyPrepareFailure;

function invalidPreparation(invalidParams: InvalidParam[]): TV3SurveyPrepareFailure {
  return {
    ok: false,
    validation: {
      valid: false,
      invalidParams,
    },
  };
}

function validPreparation<TDocument extends TV3SurveyDocument>(
  document: TDocument
): TV3SurveyPrepareResult<TDocument> {
  const validation = validateV3SurveyDocument(document);

  if (!validation.valid) {
    return invalidPreparation(validation.invalidParams);
  }

  return {
    ok: true,
    document,
    validation,
    languageRequests: deriveV3SurveyLanguageRequests(document),
  };
}

function getV3SurveyDocumentLanguages(survey: TInternalSurvey) {
  return getV3SurveyLanguages(survey, DEFAULT_V3_SURVEY_LANGUAGE).map(
    ({ code, default: isDefault, enabled }) => ({
      code,
      default: isDefault,
      enabled,
    })
  );
}

function getV3SurveyPatchAllowedLanguageCodes(survey: TInternalSurvey): string[] {
  return Array.from(
    new Set([
      ...getV3SurveyLanguages(survey, DEFAULT_V3_SURVEY_LANGUAGE).map(({ code }) => code),
      ...(survey.languages ?? []).map((surveyLanguage) => surveyLanguage.language.code),
    ])
  );
}

function buildDocumentFromSurvey(
  survey: TInternalSurvey,
  allowedLanguageCodes = getV3SurveyPatchAllowedLanguageCodes(survey)
): TV3SurveyPrepareResult<TV3SurveyDocument> {
  if (Array.isArray(survey.questions) && survey.questions.length > 0) {
    return invalidPreparation([
      {
        name: "survey",
        reason: "Legacy question-based surveys are not supported by the v3 survey management API",
      },
    ]);
  }

  const defaultLanguage = getV3SurveyDefaultLanguage(survey, DEFAULT_V3_SURVEY_LANGUAGE);
  // App surveys carry distribution/targeting; include them so the patch replacement-merge preserves
  // unspecified runtime settings (omitting the whole object on a patch keeps the stored values).
  const appFields =
    survey.type === "app"
      ? { distribution: surveyToV3Distribution(survey), targeting: surveyToV3Targeting(survey) }
      : {};
  const documentResult = createZV3SurveyDocumentBaseSchema({
    allowInternalDefaultTranslationKey: true,
    allowedLanguageCodes,
    fallbackDefaultLanguage: defaultLanguage,
  }).safeParse({
    name: survey.name,
    status: survey.status,
    metadata: survey.metadata ?? {},
    defaultLanguage,
    languages: getV3SurveyDocumentLanguages(survey),
    welcomeCard: survey.welcomeCard,
    blocks: survey.blocks,
    endings: survey.endings,
    hiddenFields: survey.hiddenFields,
    variables: survey.variables,
    ...appFields,
  });

  if (!documentResult.success) {
    return invalidPreparation(formatV3ZodInvalidParams(documentResult.error, "survey"));
  }

  return validPreparation(documentResult.data);
}

function mergeV3SurveyPatch(document: TV3SurveyDocument, patch: TV3PatchSurveyBody): TV3SurveyDocument {
  return {
    ...document,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
  };
}

function getElementIds(document: TV3SurveyDocument): Set<string> {
  return new Set(document.blocks.flatMap((block) => block.elements.map((element) => element.id)));
}

function getImmutableElementIdIssues(
  currentDocument: TV3SurveyDocument,
  patchedDocument: TV3SurveyDocument
): InvalidParam[] {
  if (currentDocument.status === "draft") {
    return [];
  }

  const patchedElementIds = getElementIds(patchedDocument);
  const issues: InvalidParam[] = [];

  currentDocument.blocks.forEach((currentBlock) => {
    const patchedBlockIndex = patchedDocument.blocks.findIndex((block) => block.id === currentBlock.id);
    if (patchedBlockIndex === -1) {
      return;
    }

    const patchedBlock = patchedDocument.blocks[patchedBlockIndex];
    currentBlock.elements.forEach((currentElement, elementIndex) => {
      if (currentElement.isDraft || patchedElementIds.has(currentElement.id)) {
        return;
      }

      const patchedElement = patchedBlock.elements[elementIndex];
      if (!patchedElement || patchedElement.id === currentElement.id) {
        return;
      }

      issues.push({
        name: `blocks.${patchedBlockIndex}.elements.${elementIndex}.id`,
        reason: `Element id '${currentElement.id}' cannot be changed because the survey and element are no longer drafts`,
        code: "immutable_identifier",
        identifier: currentElement.id,
        referenceType: "element",
      });
    });
  });

  return issues;
}

export function prepareV3SurveyCreate<TDocument extends TV3CreateSurveyBody>(
  document: TDocument
): TV3SurveyPrepareResult<TDocument> {
  return validPreparation(document);
}

export function prepareV3SurveyCreateInput(input: unknown): TV3SurveyPrepareResult<TV3CreateSurveyBody> {
  const parsed = ZV3CreateSurveyBody.safeParse(input);

  if (!parsed.success) {
    return invalidPreparation(formatV3ZodInvalidParams(parsed.error, "data"));
  }

  return prepareV3SurveyCreate(parsed.data);
}

export function prepareV3SurveyPatchInput(
  survey: TInternalSurvey,
  input: unknown
): TV3SurveyPrepareResult<TV3SurveyDocument> {
  const allowedLanguageCodes = getV3SurveyPatchAllowedLanguageCodes(survey);
  const currentDocument = buildDocumentFromSurvey(survey, allowedLanguageCodes);

  if (!currentDocument.ok) {
    return currentDocument;
  }

  const parsedPatch = createZV3PatchSurveyBodySchema(
    currentDocument.document.defaultLanguage,
    { allowedLanguageCodes },
    survey.type
  ).safeParse(input);

  if (!parsedPatch.success) {
    return invalidPreparation(formatV3ZodInvalidParams(parsedPatch.error, "data"));
  }

  const patchedDocument = mergeV3SurveyPatch(currentDocument.document, parsedPatch.data);
  const immutableElementIdIssues = getImmutableElementIdIssues(currentDocument.document, patchedDocument);
  if (immutableElementIdIssues.length > 0) {
    return invalidPreparation(immutableElementIdIssues);
  }

  return validPreparation(patchedDocument);
}
