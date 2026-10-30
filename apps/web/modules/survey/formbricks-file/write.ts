import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { surveyToV3Targeting } from "@/app/api/v3/surveys/distribution";
import { getV3SurveyLanguages } from "@/app/api/v3/surveys/language";
import { DEFAULT_V3_SURVEY_LANGUAGE } from "@/app/api/v3/surveys/schemas";
import {
  type TV3SurveyResourceVisibility,
  serializeV3SurveyResource,
} from "@/app/api/v3/surveys/serializers";
import { collectV3TargetingAttributeKeys } from "@/app/api/v3/surveys/targeting";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import {
  FORMBRICKS_FILE_FORMAT,
  FORMBRICKS_FILE_V1_SCHEMA_URL,
  type TFormbricksFileActionClass,
  type TFormbricksFileAttributeKey,
  type TFormbricksFileEmbeddedField,
  type TFormbricksFileLanguage,
  type TFormbricksFileMetaV1,
} from "./envelope";

type TV3SurveyResource = ReturnType<typeof serializeV3SurveyResource>;

/** What the v3 GET resource has and a create body refuses: ids, timestamps and the caller's view of it. */
type TServerOwnedSurveyField =
  | "id"
  | "workspaceId"
  | "createdAt"
  | "updatedAt"
  | "archivedAt"
  | "visibility"
  | "owner"
  | "access";

/** The survey as a Formbricks file carries it: the v3 create body without `workspaceId`. */
export type TFormbricksFileSurvey = Omit<TV3SurveyResource, TServerOwnedSurveyField | "languages"> & {
  languages: { code: string; default: boolean; enabled: boolean }[];
};

/** A Formbricks file in the format this instance writes, as it is saved. */
export type TFormbricksFile = {
  $schema: string;
  formbricks: TFormbricksFileMetaV1;
  survey: TFormbricksFileSurvey;
  references: {
    actionClasses: TFormbricksFileActionClass[];
    attributeKeys: TFormbricksFileAttributeKey[];
    embeddedFields: TFormbricksFileEmbeddedField[];
    languages: TFormbricksFileLanguage[];
  };
};

/**
 * The contact attribute keys a survey's targeting names, which its file embeds. Only app surveys have
 * targeting; the caller looks the definitions up in the survey's workspace.
 */
export const getFormbricksFileAttributeKeys = (survey: TSurvey): string[] =>
  survey.type === "app" ? collectV3TargetingAttributeKeys(surveyToV3Targeting(survey).filters) : [];

const toFileSurvey = (resource: TV3SurveyResource): TFormbricksFileSurvey => {
  const {
    id: _id,
    workspaceId: _workspaceId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    archivedAt: _archivedAt,
    visibility: _visibility,
    owner: _owner,
    access: _access,
    languages,
    ...document
  } = resource;

  // An alias is the workspace's name for a language, not part of the survey: the create body refuses it,
  // so the file carries it in `references.languages` instead.
  return {
    ...document,
    languages: languages.map(({ code, default: isDefault, enabled }) => ({
      code,
      default: isDefault,
      enabled,
    })),
  };
};

/** The action classes the file's triggers point at, once each. Link surveys carry no triggers. */
const collectActionClasses = (
  survey: TSurvey,
  document: TFormbricksFileSurvey
): TFormbricksFileActionClass[] => {
  const referencedIds = new Set(document.distribution?.triggers.map((trigger) => trigger.actionClassId));
  const actionClasses = new Map<string, TFormbricksFileActionClass>();

  for (const { actionClass } of survey.triggers) {
    if (!referencedIds.has(actionClass.id) || actionClasses.has(actionClass.id)) continue;
    actionClasses.set(actionClass.id, {
      id: actionClass.id,
      name: actionClass.name,
      description: actionClass.description,
      type: actionClass.type,
      key: actionClass.key,
      noCodeConfig: actionClass.noCodeConfig,
    });
  }

  return [...actionClasses.values()];
};

/**
 * The workspace-library fields the survey links. A local field travels inside the survey's own hidden
 * fields and variables; a shared one has a definition outside it, which the file has to carry.
 */
const collectSharedEmbeddedFields = (survey: TSurvey): TFormbricksFileEmbeddedField[] =>
  (survey.embeddedFields ?? []).flatMap(({ field, link }) =>
    field.key === null
      ? []
      : [
          {
            storageKey: link.storageKey,
            key: field.key,
            name: field.name,
            source: field.source,
            dataType: field.dataType,
            defaultValue: field.defaultValue,
            locked: field.locked,
          },
        ]
  );

/** The aliases the survey's languages have in its workspace, which the survey part cannot carry. */
const collectLanguageAliases = (survey: TSurvey): TFormbricksFileLanguage[] =>
  survey.languages.flatMap(({ language }) =>
    language.alias ? [{ code: language.code, alias: language.alias }] : []
  );

/**
 * Write a survey as a Formbricks file in the current format (ADR 0016).
 *
 * The `survey` part is the v3 GET resource minus every server-owned field, which is the create body
 * without `workspaceId`, with element, block, ending and choice ids kept so a later import can match
 * the survey and its logic still points where it did. Every configured language is requested, so a
 * translation a draft is still missing is filled from the default language rather than left out.
 * `/storage/…` media paths become absolute URLs, so the file's images keep loading from this
 * instance after a move to another.
 *
 * The survey is not validated against the create rules here: a broken draft still exports, and the
 * import names whatever it refuses.
 *
 * @param attributeKeys The definitions of {@link getFormbricksFileAttributeKeys}, from the survey's workspace.
 */
export const writeFormbricksFile = ({
  survey,
  visibility,
  attributeKeys,
  appVersion,
  exportedAt,
}: {
  survey: TSurvey;
  visibility: TV3SurveyResourceVisibility;
  attributeKeys: TFormbricksFileAttributeKey[];
  appVersion: string;
  exportedAt: Date;
}): TFormbricksFile => {
  const languageCodes = getV3SurveyLanguages(survey, DEFAULT_V3_SURVEY_LANGUAGE).map(({ code }) => code);
  const resource = serializeV3SurveyResource(survey, visibility, { lang: languageCodes });
  const document = resolveStorageUrlsInObject(toFileSurvey(resource));

  return {
    $schema: FORMBRICKS_FILE_V1_SCHEMA_URL,
    formbricks: {
      format: FORMBRICKS_FILE_FORMAT,
      exportedAt: exportedAt.toISOString(),
      appVersion,
      source: {
        surveyId: survey.id,
        workspaceId: survey.workspaceId,
        updatedAt: survey.updatedAt.toISOString(),
      },
    },
    survey: document,
    references: {
      actionClasses: collectActionClasses(survey, document),
      attributeKeys,
      embeddedFields: collectSharedEmbeddedFields(survey),
      languages: collectLanguageAliases(survey),
    },
  };
};
