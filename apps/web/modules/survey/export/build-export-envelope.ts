import { type Result, err, ok } from "@formbricks/types/error-handlers";
import type {
  TSurvey,
  TSurveyHiddenFields,
  TSurveyStatus,
  TSurveyVariables,
} from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import {
  SURVEY_EXPORT_FORMAT,
  type TSurveyExportActionClassReference,
  type TSurveyExportMetadata,
  ZSurveyExportEnvelope,
} from "@/app/api/v3/surveys/export/schemas";
import { getV3SurveyLanguages } from "@/app/api/v3/surveys/language";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import {
  DEFAULT_V3_SURVEY_LANGUAGE,
  type TV3SurveyDistribution,
  formatV3ZodInvalidParams,
} from "@/app/api/v3/surveys/schemas";
import { serializeV3SurveyResource } from "@/app/api/v3/surveys/serializers";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";

export type TSurveyExportContext = {
  appVersion: string;
  publicUrl: string;
  /** Injectable for deterministic tests; defaults to now. */
  exportedAt?: Date;
};

/** A translatable field in the file: a public locale-code map (`{ "en-US": "…", "de-DE": "…" }`). */
export type TSurveyExportI18n = Record<string, string>;

/** Public shapes of the document's parts. Loose on purpose: element and ending fields vary by type. */
export type TSurveyExportElement = { id: string; type: string; headline?: TSurveyExportI18n } & Record<
  string,
  unknown
>;
export type TSurveyExportBlock = {
  id: string;
  name: string;
  elements: TSurveyExportElement[];
  logic?: unknown[];
  logicFallback?: string;
} & Record<string, unknown>;
export type TSurveyExportEnding = { id: string; type: "endScreen" | "redirectToUrl" } & Record<
  string,
  unknown
>;

/**
 * The `survey` member of the envelope as written to the file: the v3 GET resource minus every
 * instance-bound field. Locale maps are public (`{ "en-US": … }`), so the file round-trips through
 * `POST /api/v3/surveys` unchanged apart from `workspaceId`.
 */
export type TSurveyExportDocument = {
  name: string;
  type: TSurvey["type"];
  status: TSurveyStatus;
  metadata: Record<string, unknown>;
  defaultLanguage: string;
  languages: { code: string; default: boolean; enabled: boolean }[];
  welcomeCard: Record<string, unknown>;
  blocks: TSurveyExportBlock[];
  endings: TSurveyExportEnding[];
  hiddenFields: TSurveyHiddenFields;
  variables: TSurveyVariables;
  distribution?: TV3SurveyDistribution;
};

export type TSurveyExportEnvelopeFile = {
  formbricks: TSurveyExportMetadata;
  survey: TSurveyExportDocument;
  references: { actionClasses: TSurveyExportActionClassReference[] };
};

/**
 * Legacy question-based surveys are converted to blocks first — the v3 document has no `questions`.
 * Returns the survey untouched when it already carries blocks.
 */
function withBlocks(survey: TSurvey): TSurvey {
  if (Array.isArray(survey.questions) && survey.questions.length > 0 && survey.blocks.length === 0) {
    return {
      ...survey,
      blocks: transformQuestionsToBlocks(survey.questions, survey.endings),
      questions: [],
    };
  }

  return survey;
}

function countElements(survey: TSurvey): number {
  return survey.blocks.reduce((count, block) => count + block.elements.length, 0);
}

/**
 * Action-class definitions the document's triggers point at, reduced to the six portable fields and
 * de-duplicated by id. Link surveys have no triggers, so this is empty for them.
 */
function collectActionClassReferences(survey: TSurvey): TSurveyExportActionClassReference[] {
  const seen = new Set<string>();
  const references: TSurveyExportActionClassReference[] = [];

  for (const trigger of survey.triggers ?? []) {
    const actionClass = trigger.actionClass;
    if (seen.has(actionClass.id)) {
      continue;
    }
    seen.add(actionClass.id);
    references.push({
      id: actionClass.id,
      name: actionClass.name,
      key: actionClass.key,
      type: actionClass.type,
      noCodeConfig: actionClass.noCodeConfig,
      description: actionClass.description,
    });
  }

  return references;
}

/**
 * Build the portable export envelope for a stored survey.
 *
 * The document is the `GET /api/v3/surveys/{id}` resource with the instance-bound fields removed
 * (`id`, `workspaceId`, timestamps, `archivedAt`) and `targeting` dropped — segments are out of v1;
 * triggers and languages travel. The serializer is asked for every configured language explicitly so
 * a translation that is missing on a draft is filled from the default language instead of making the
 * survey unexportable; the editor allows saving incomplete translations, the v3 create route does not.
 *
 * Before the envelope is returned it is run through the exact create-side validation
 * (`prepareV3SurveyCreateInput`: strict schema, reference and recall checks, declared locales, media).
 * A survey that would not re-import must not export silently (edge case #21).
 */
export function buildSurveyExportEnvelope(
  survey: TSurvey,
  ctx: TSurveyExportContext
): Result<TSurveyExportEnvelopeFile, InvalidParam[]> {
  const blockSurvey = withBlocks(survey);

  if (countElements(blockSurvey) === 0) {
    return err([
      {
        name: "survey.blocks",
        reason: "Empty surveys cannot be exported. Add at least one question first.",
      },
    ]);
  }

  const languageCodes = getV3SurveyLanguages(blockSurvey, DEFAULT_V3_SURVEY_LANGUAGE).map(
    (language) => language.code
  );
  const resource = serializeV3SurveyResource(blockSurvey, { lang: languageCodes });
  const {
    id: _id,
    workspaceId: _workspaceId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    archivedAt: _archivedAt,
    targeting: _targeting,
    languages,
    ...rest
  } = resource;
  // Aliases are a workspace setting, not part of the survey document: the create schema rejects them.
  // The serializer types translatable values loosely (`TSerializedValue`); the create-side validation
  // below is what proves the shape, so the cast states the contract rather than inventing one.
  const document = {
    ...rest,
    languages: languages.map(({ code, default: isDefault, enabled }) => ({
      code,
      default: isDefault,
      enabled,
    })),
  } as unknown as TSurveyExportDocument;

  const preparation = prepareV3SurveyCreateInput({ workspaceId: survey.workspaceId, ...document });
  if (!preparation.ok) {
    return err(preparation.validation.invalidParams);
  }

  const envelope: TSurveyExportEnvelopeFile = {
    formbricks: {
      exportFormat: SURVEY_EXPORT_FORMAT,
      exportedAt: (ctx.exportedAt ?? new Date()).toISOString(),
      appVersion: ctx.appVersion,
      source: {
        url: ctx.publicUrl,
        workspaceId: survey.workspaceId,
        surveyId: survey.id,
      },
    },
    survey: document,
    references: {
      actionClasses: collectActionClassReferences(blockSurvey),
    },
  };

  const parsed = ZSurveyExportEnvelope.safeParse(envelope);
  if (!parsed.success) {
    return err(formatV3ZodInvalidParams(parsed.error, "survey"));
  }

  return ok(envelope);
}
