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
import {
  type TV3SurveyDocumentValidationResult,
  type TV3SurveyPrecedencePolicy,
  validateV3SurveyDocument,
} from "./validation";

type TV3SurveyPrepareSuccess<TDocument> = {
  ok: true;
  document: TDocument;
  validation: Extract<TV3SurveyDocumentValidationResult, { valid: true }>;
  languageRequests: TV3SurveyLanguageRequest[];
  /**
   * ENG-3069: a round-tripped `updatedAt` doubles as an optimistic-concurrency precondition. It is
   * surfaced rather than verified here — the compare-and-set in executeV3SurveyPatch is what enforces it.
   */
  precondition?: { expectedUpdatedAt: Date };
};

type TV3SurveyPrepareFailure = {
  ok: false;
  validation: Extract<TV3SurveyDocumentValidationResult, { valid: false }>;
  /**
   * ENG-3070: whether the request or the *stored* survey is at fault. A stored survey that no longer
   * satisfies the v3 document contract fails every patch, including one that never touches the
   * offending field — and reporting that as `invalid_params` on paths the caller never sent reads as
   * a client error when it is a state error.
   */
  origin?: "request" | "storedSurvey";
};

export type TV3SurveyPrepareResult<TDocument> = TV3SurveyPrepareSuccess<TDocument> | TV3SurveyPrepareFailure;

function invalidPreparation(
  invalidParams: InvalidParam[],
  origin: "request" | "storedSurvey" = "request"
): TV3SurveyPrepareFailure {
  return {
    ok: false,
    validation: {
      valid: false,
      invalidParams,
    },
    origin,
  };
}

function validPreparation<TDocument extends TV3SurveyDocument>(
  document: TDocument,
  precedence?: TV3SurveyPrecedencePolicy
): TV3SurveyPrepareResult<TDocument> {
  const validation = validateV3SurveyDocument(document, precedence);

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
    return invalidPreparation(
      [
        {
          name: "survey",
          reason: "Legacy question-based surveys are not supported by the v3 survey management API",
        },
      ],
      "storedSurvey"
    );
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
    return invalidPreparation(formatV3ZodInvalidParams(documentResult.error, "survey"), "storedSurvey");
  }

  // `skip`: the stored document's ordering is not this request's fault. See TV3SurveyPrecedencePolicy.
  return validPreparation(documentResult.data, { mode: "skip" });
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

/**
 * Server-owned fields that GET emits and PATCH used to reject outright (ENG-3069).
 *
 * A caller doing the obvious thing — fetch the survey, change one field, send it back — got a 400
 * naming eight fields it had not chosen to send, and had to learn a strip-list by trial and error.
 * These are now accepted and verified: echoing the value GET returned is a no-op, and changing one
 * is a 422 `read_only_field` rather than a silent ignore, so a genuine mistake still surfaces.
 *
 * They are split off the raw body *before* the patch schema runs. That matters for `defaultLanguage`:
 * the document normalizer uses a body-supplied `defaultLanguage` to interpret every i18n map, so
 * letting a mismatched one through would produce a confusing wall of locale errors before this
 * check could report the real problem.
 */
const READ_ONLY_PATCH_KEYS = [
  "id",
  "workspaceId",
  "type",
  "createdAt",
  "updatedAt",
  "archivedAt",
  "defaultLanguage",
] as const;

type TReadOnlySplit = {
  issues: InvalidParam[];
  rest: Record<string, unknown>;
  precondition?: { expectedUpdatedAt: Date };
};

function readOnlyIssue(name: string, reason: string, submitted: unknown): InvalidParam {
  return {
    name,
    reason,
    code: "read_only_field",
    // The submitted value goes in `identifier`, never interpolated into `reason`.
    ...(typeof submitted === "string" ? { identifier: submitted } : {}),
  };
}

function sameInstant(submitted: unknown, stored: Date | null): boolean {
  if (stored === null) {
    return submitted === null;
  }
  return typeof submitted === "string" && new Date(submitted).getTime() === stored.getTime();
}

function splitReadOnlyPatchFields(
  survey: TInternalSurvey,
  storedDocument: TV3SurveyDocument,
  input: unknown
): TReadOnlySplit {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { issues: [], rest: {} };
  }

  const body = { ...(input as Record<string, unknown>) };
  const issues: InvalidParam[] = [];
  let precondition: { expectedUpdatedAt: Date } | undefined;

  for (const key of READ_ONLY_PATCH_KEYS) {
    if (!(key in body)) continue;
    const submitted = body[key];
    delete body[key];

    switch (key) {
      case "id":
        if (submitted !== survey.id) {
          issues.push(
            readOnlyIssue(
              "id",
              "Field 'id' is read-only and must match the survey being patched; omit it or echo the value returned by GET",
              submitted
            )
          );
        }
        break;
      case "workspaceId":
        if (submitted !== survey.workspaceId) {
          issues.push(
            readOnlyIssue(
              "workspaceId",
              "Field 'workspaceId' is read-only; a survey cannot be moved to another workspace",
              submitted
            )
          );
        }
        break;
      case "type":
        if (submitted !== survey.type) {
          issues.push(
            readOnlyIssue(
              "type",
              "Field 'type' is immutable after creation; create a new survey to change between link and app",
              submitted
            )
          );
        }
        break;
      case "createdAt":
        if (!sameInstant(submitted, survey.createdAt)) {
          issues.push(
            readOnlyIssue(
              "createdAt",
              "Field 'createdAt' is server-owned and cannot be changed; omit it or echo the value returned by GET",
              submitted
            )
          );
        }
        break;
      case "archivedAt":
        if (!sameInstant(submitted, survey.archivedAt ?? null)) {
          issues.push(
            readOnlyIssue(
              "archivedAt",
              "Field 'archivedAt' is server-owned; use the archive and restore endpoints to change it",
              submitted
            )
          );
        }
        break;
      case "defaultLanguage":
        if (
          typeof submitted !== "string" ||
          submitted.toLowerCase() !== storedDocument.defaultLanguage.toLowerCase()
        ) {
          issues.push({
            ...readOnlyIssue(
              "defaultLanguage",
              "Field 'defaultLanguage' cannot be changed through PATCH; the default language is the languages[] entry with default: true and is fixed for the survey",
              submitted
            ),
            referenceType: "language",
          });
        }
        break;
      case "updatedAt":
        // Not compared: this is the optimistic-concurrency precondition, enforced at the write.
        if (typeof submitted === "string" && !Number.isNaN(new Date(submitted).getTime())) {
          precondition = { expectedUpdatedAt: new Date(submitted) };
        } else {
          issues.push(
            readOnlyIssue(
              "updatedAt",
              "Field 'updatedAt' must be the ISO 8601 date-time returned by GET; it acts as an optimistic-concurrency precondition",
              submitted
            )
          );
        }
        break;
    }
  }

  return { issues, rest: body, precondition };
}

/**
 * `languages[].alias` is emitted by GET but belongs to the workspace language, not the survey, so the
 * survey patch schema rejects it. Strip it so a round-tripped body validates; a changed value is a
 * read-only violation like the rest.
 */
function splitLanguageAliases(
  survey: TInternalSurvey,
  body: Record<string, unknown>
): { issues: InvalidParam[]; rest: Record<string, unknown> } {
  const languages = body.languages;
  if (!Array.isArray(languages)) {
    return { issues: [], rest: body };
  }

  const storedAliasByCode = new Map(
    getV3SurveyLanguages(survey, DEFAULT_V3_SURVEY_LANGUAGE).map((language) => [
      language.code.toLowerCase(),
      language.alias ?? null,
    ])
  );
  const issues: InvalidParam[] = [];

  const stripped = languages.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || !("alias" in entry)) {
      return entry;
    }

    const { alias, ...rest } = entry as Record<string, unknown>;
    const code = typeof rest.code === "string" ? rest.code.toLowerCase() : "";
    const stored = storedAliasByCode.get(code) ?? null;
    const submitted = alias === undefined || alias === "" ? null : alias;

    if (submitted !== stored) {
      issues.push(
        readOnlyIssue(
          `languages.${index}.alias`,
          "Field 'alias' is read-only; language aliases are configured on the workspace language",
          alias
        )
      );
    }

    return rest;
  });

  return { issues, rest: { ...body, languages: stripped } };
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

  const readOnly = splitReadOnlyPatchFields(survey, currentDocument.document, input);
  const aliases = splitLanguageAliases(survey, readOnly.rest);
  const readOnlyIssues = [...readOnly.issues, ...aliases.issues];
  if (readOnlyIssues.length > 0) {
    return invalidPreparation(readOnlyIssues);
  }

  const parsedPatch = createZV3PatchSurveyBodySchema(
    currentDocument.document.defaultLanguage,
    { allowedLanguageCodes },
    survey.type
  ).safeParse(aliases.rest);

  if (!parsedPatch.success) {
    return invalidPreparation(formatV3ZodInvalidParams(parsedPatch.error, "data"));
  }

  const patchedDocument = mergeV3SurveyPatch(currentDocument.document, parsedPatch.data);
  const immutableElementIdIssues = getImmutableElementIdIssues(currentDocument.document, patchedDocument);
  if (immutableElementIdIssues.length > 0) {
    return invalidPreparation(immutableElementIdIssues);
  }

  const prepared = validPreparation(patchedDocument, {
    mode: "introduced",
    baseline: currentDocument.document,
  });
  return prepared.ok && readOnly.precondition
    ? { ...prepared, precondition: readOnly.precondition }
    : prepared;
}
