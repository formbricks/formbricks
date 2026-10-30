import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { TSurveyHiddenFields, TSurveyVariable } from "@formbricks/types/surveys/types";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { getImportedName, importedNamePrefix } from "@/modules/survey/import/core/imported-name";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import { SURVEY_IMPORT_MAX_TAKEN_NAMES } from "@/modules/survey/import/limits";
import type {
  TFormbricksFileActionClass,
  TFormbricksFileAttributeKey,
  TFormbricksFileLanguage,
  TFormbricksFileReferences,
} from "./envelope";

/**
 * The reference resolver of a Formbricks file import (ADR 0016, ENG-6850): what the survey points at
 * outside itself, found in the target workspace by natural key or created there.
 *
 * - **Action classes** a trigger uses: a code action by its key, a no-code action by its configuration.
 *   One that is missing is created; when its name is taken by another action, it is "<name> (imported)"
 *   or "(imported N)", as a survey is named.
 * - **Attribute keys** targeting names: by key, created when missing.
 * - **Languages**: by code (the create adds a missing one); one the import adds gets the source
 *   workspace's alias.
 * - **Shared embedded-data fields**: linked when the workspace's library has one with the same key,
 *   source and data type; otherwise the field stays the survey's own, as Copy-to does.
 *
 * Each kind is looked up in one bounded query, never one per item, and the plan is computed again inside the
 * commit's transaction, so the ids it writes are the ones the target has, never ids a client resolved.
 * The preview runs the same plan read-only, to say in the report what the import will create.
 */

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/** A client the resolver reads through: the shared one for a preview, the transaction for a commit. */
type TReader = Pick<
  Prisma.TransactionClient,
  "actionClass" | "contactAttributeKey" | "language" | "embeddedData" | "$queryRaw"
>;

type TActionClassCreate = Pick<
  TFormbricksFileActionClass,
  "description" | "type" | "key" | "noCodeConfig"
> & {
  name: string;
};

export interface TFormbricksFileReferencePlan {
  /** Each action class a trigger uses, by its id in the file: the target's id, or what to create. */
  actionClasses: Map<string, { id: string } | { create: TActionClassCreate }>;
  attributeKeysToCreate: TFormbricksFileAttributeKey[];
  languagesToCreate: TFormbricksFileLanguage[];
  /** One note per action class and attribute key the import creates. */
  issues: TSurveyImportPipelineIssue[];
}

/** JSON with every object's keys sorted, so two no-code configurations compare by content alone. */
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nested: unknown) =>
    isPlainObject(nested)
      ? Object.fromEntries(
          Object.keys(nested)
            .sort()
            .map((key) => [key, nested[key]])
        )
      : nested
  );

/** The action class ids the survey's triggers name, once each, in order. */
const getTriggerActionClassIds = (survey: Record<string, unknown>): string[] => {
  const distribution = isPlainObject(survey.distribution) ? survey.distribution : {};
  const triggers = Array.isArray(distribution.triggers) ? distribution.triggers : [];
  const ids = triggers
    .map((trigger: unknown) => (isPlainObject(trigger) ? trigger.actionClassId : undefined))
    .filter((id): id is string => typeof id === "string");
  return [...new Set(ids)];
};

/** The attribute keys the survey's targeting filters name, from a filter tree of any depth. */
const getTargetingAttributeKeys = (filters: unknown, keys = new Set<string>()): Set<string> => {
  if (!Array.isArray(filters)) return keys;
  for (const node of filters) {
    if (!isPlainObject(node)) continue;
    const { resource } = node;
    if (Array.isArray(resource)) {
      getTargetingAttributeKeys(resource, keys);
      continue;
    }
    const root = isPlainObject(resource) && isPlainObject(resource.root) ? resource.root : {};
    if (root.type === "attribute" && typeof root.contactAttributeKey === "string") {
      keys.add(root.contactAttributeKey);
    }
    if (root.type === "person" && root.personIdentifier === "userId") keys.add("userId");
  }
  return keys;
};

/** The workspace's no-code actions with one of these configurations, the oldest per configuration. */
const findNoCodeActionClasses = async (
  db: TReader,
  workspaceId: string,
  configs: readonly unknown[]
): Promise<{ id: string; noCodeConfig: unknown }[]> => {
  if (configs.length === 0) return [];
  // jsonb equality ignores key order, so the configurations are compared in the database. DISTINCT ON
  // keeps one row per configuration, which bounds the read by what the file asks for.
  return db.$queryRaw<{ id: string; noCodeConfig: unknown }[]>`
    SELECT DISTINCT ON ("noCodeConfig") id, "noCodeConfig"
    FROM "ActionClass"
    WHERE "workspaceId" = ${workspaceId}
      AND type = 'noCode'
      AND "noCodeConfig" IN (${Prisma.join(configs.map((config) => Prisma.sql`${JSON.stringify(config)}::jsonb`))})
    ORDER BY "noCodeConfig", created_at ASC, id ASC
    LIMIT ${configs.length}`;
};

const planActionClasses = async (
  db: TReader,
  workspaceId: string,
  wanted: TFormbricksFileActionClass[],
  t: TTranslate
): Promise<Pick<TFormbricksFileReferencePlan, "actionClasses" | "issues">> => {
  const actionClasses: TFormbricksFileReferencePlan["actionClasses"] = new Map();
  const issues: TSurveyImportPipelineIssue[] = [];
  if (wanted.length === 0) return { actionClasses, issues };

  const codeKeys = [
    ...new Set(
      wanted.flatMap((actionClass) =>
        actionClass.type === "code" && actionClass.key ? [actionClass.key] : []
      )
    ),
  ];
  const noCodeConfigs = wanted.flatMap((actionClass) =>
    actionClass.type === "noCode" && actionClass.noCodeConfig ? [actionClass.noCodeConfig] : []
  );
  // One query per kind, each bounded: the code actions by key (unique in a workspace), the no-code
  // actions by configuration, and the names a created action could clash with — its own, and every
  // "(imported N)" of it.
  const [byKeyRows, byConfigRows, takenRows] = await Promise.all([
    codeKeys.length > 0
      ? db.actionClass.findMany({
          where: { workspaceId, key: { in: codeKeys } },
          select: { id: true, key: true },
          take: codeKeys.length,
        })
      : Promise.resolve([]),
    findNoCodeActionClasses(db, workspaceId, noCodeConfigs),
    db.actionClass.findMany({
      where: {
        workspaceId,
        OR: wanted.flatMap((actionClass) => [
          { name: actionClass.name },
          { name: { startsWith: escapeLikePattern(importedNamePrefix(actionClass.name, t)) } },
        ]),
      },
      select: { name: true },
      take: SURVEY_IMPORT_MAX_TAKEN_NAMES,
    }),
  ]);

  const takenNames = new Set(takenRows.map((actionClass) => actionClass.name));
  const byKey = new Map(
    byKeyRows.flatMap((actionClass) => (actionClass.key ? [[actionClass.key, actionClass.id]] : []))
  );
  const byConfig = new Map(byConfigRows.map((row) => [canonicalJson(row.noCodeConfig), row.id]));

  // What the file's own actions already planned, so two that are the same action (one key, or one
  // configuration) become one, and both triggers point at it.
  const plannedByIdentity = new Map<string, { id: string } | { create: TActionClassCreate }>();
  const identityOf = (actionClass: TFormbricksFileActionClass): string =>
    actionClass.type === "code"
      ? `code:${actionClass.key ?? ""}`
      : `noCode:${canonicalJson(actionClass.noCodeConfig)}`;

  for (const actionClass of wanted) {
    const identity = identityOf(actionClass);
    const planned = plannedByIdentity.get(identity);
    if (planned) {
      actionClasses.set(actionClass.id, planned);
      continue;
    }

    const matchId =
      actionClass.type === "code"
        ? byKey.get(actionClass.key ?? "")
        : byConfig.get(canonicalJson(actionClass.noCodeConfig));
    if (matchId) {
      const target = { id: matchId };
      plannedByIdentity.set(identity, target);
      actionClasses.set(actionClass.id, target);
      continue;
    }

    const name = getImportedName(actionClass.name, (candidate) => takenNames.has(candidate), t, {
      keepPlainName: true,
    });
    takenNames.add(name);
    const target = {
      create: {
        name,
        description: actionClass.description,
        type: actionClass.type,
        key: actionClass.key,
        noCodeConfig: actionClass.noCodeConfig,
      },
    };
    plannedByIdentity.set(identity, target);
    actionClasses.set(actionClass.id, target);
    issues.push({ code: "action_class_created", severity: "info", params: { name } });
  }

  return { actionClasses, issues };
};

const planAttributeKeys = async (
  db: TReader,
  workspaceId: string,
  wanted: TFormbricksFileAttributeKey[],
  fieldPrefix: string | null
): Promise<Pick<TFormbricksFileReferencePlan, "attributeKeysToCreate" | "issues">> => {
  if (wanted.length === 0) return { attributeKeysToCreate: [], issues: [] };

  const [existing, count] = await Promise.all([
    db.contactAttributeKey.findMany({
      where: { workspaceId, key: { in: wanted.map((attributeKey) => attributeKey.key) } },
      select: { key: true },
    }),
    db.contactAttributeKey.count({ where: { workspaceId } }),
  ]);
  const existingKeys = new Set(existing.map((attributeKey) => attributeKey.key));
  const attributeKeysToCreate = wanted.filter((attributeKey) => !existingKeys.has(attributeKey.key));

  if (count + attributeKeysToCreate.length > MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
    throw new SurveyImportInputError(
      [
        {
          name: fieldPrefix ? `${fieldPrefix}.references.attributeKeys` : "references.attributeKeys",
          reason: `Importing this survey adds ${attributeKeysToCreate.length} attribute keys, past the ${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT} a workspace can have`,
          code: "limit_exceeded",
        },
      ],
      "The workspace cannot hold the attribute keys this survey needs.",
      "formbricks_file_invalid"
    );
  }

  return {
    attributeKeysToCreate,
    issues: attributeKeysToCreate.map(({ key }) => ({
      code: "attribute_key_created",
      severity: "info",
      params: { key },
    })),
  };
};

const planLanguages = async (
  db: TReader,
  workspaceId: string,
  survey: Record<string, unknown>,
  aliases: readonly TFormbricksFileLanguage[]
): Promise<TFormbricksFileLanguage[]> => {
  // Spelled as the survey spells them: that is the code the create looks the language up by.
  const surveyCodes = new Map(
    (Array.isArray(survey.languages) ? survey.languages : [])
      .map((language: unknown) => (isPlainObject(language) ? language.code : undefined))
      .filter((code): code is string => typeof code === "string")
      .map((code) => [code.toLowerCase(), code])
  );
  const wanted = aliases.flatMap(({ code, alias }) => {
    const surveyCode = surveyCodes.get(code.toLowerCase());
    return surveyCode ? [{ code: surveyCode, alias }] : [];
  });
  if (wanted.length === 0) return [];

  const existing = await db.language.findMany({
    where: { workspaceId, code: { in: wanted.map((language) => language.code), mode: "insensitive" } },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((language) => language.code.toLowerCase()));
  return wanted.filter((language) => !existingCodes.has(language.code.toLowerCase()));
};

/**
 * What the import will match and create, read in one query per kind of reference. Only references the
 * survey uses count: an action class no trigger names, or a key no filter names, is left alone.
 *
 * @param survey The survey after fitting, so references to parts it lost are not created.
 */
export const planFormbricksFileReferences = async (
  db: TReader,
  {
    workspaceId,
    survey,
    references,
    t,
    fieldPrefix,
  }: {
    workspaceId: string;
    survey: Record<string, unknown>;
    references: TFormbricksFileReferences;
    t: TTranslate;
    /** Where a refusal names the references from: `file` for an upload, nothing for a request body. */
    fieldPrefix: string | null;
  }
): Promise<TFormbricksFileReferencePlan> => {
  const triggerIds = new Set(getTriggerActionClassIds(survey));
  const targeting = isPlainObject(survey.targeting) ? survey.targeting : {};
  const keys = getTargetingAttributeKeys(targeting.filters);

  const [actions, attributeKeys, languagesToCreate] = await Promise.all([
    planActionClasses(
      db,
      workspaceId,
      references.actionClasses.filter((actionClass) => triggerIds.has(actionClass.id)),
      t
    ),
    planAttributeKeys(
      db,
      workspaceId,
      references.attributeKeys.filter((attributeKey) => keys.has(attributeKey.key)),
      fieldPrefix
    ),
    planLanguages(db, workspaceId, survey, references.languages ?? []),
  ]);

  return {
    actionClasses: actions.actionClasses,
    attributeKeysToCreate: attributeKeys.attributeKeysToCreate,
    languagesToCreate,
    issues: [...actions.issues, ...attributeKeys.issues],
  };
};

/**
 * Create what the plan says is missing, in the caller's transaction, one query per kind, and return
 * the target id of every action class the survey's triggers name, by its id in the file.
 */
export const applyFormbricksFileReferences = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  plan: TFormbricksFileReferencePlan
): Promise<Map<string, string>> => {
  const toCreate = new Map<TActionClassCreate, string[]>();
  const actionClassIds = new Map<string, string>();
  for (const [sourceId, target] of plan.actionClasses) {
    if ("id" in target) {
      actionClassIds.set(sourceId, target.id);
    } else {
      toCreate.set(target.create, [...(toCreate.get(target.create) ?? []), sourceId]);
    }
  }

  const creates = [...toCreate.keys()];
  const [created] = await Promise.all([
    creates.length > 0
      ? tx.actionClass.createManyAndReturn({
          data: creates.map((actionClass) => ({
            workspaceId,
            name: actionClass.name,
            description: actionClass.description,
            type: actionClass.type,
            key: actionClass.type === "code" ? actionClass.key : null,
            noCodeConfig: actionClass.noCodeConfig ?? undefined,
          })),
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    plan.attributeKeysToCreate.length > 0
      ? tx.contactAttributeKey.createMany({
          data: plan.attributeKeysToCreate.map((attributeKey) => ({ workspaceId, ...attributeKey })),
        })
      : Promise.resolve(null),
    plan.languagesToCreate.length > 0
      ? tx.language.createMany({
          data: plan.languagesToCreate.map(({ code, alias }) => ({ workspaceId, code, alias })),
          skipDuplicates: true,
        })
      : Promise.resolve(null),
  ]);

  const createdIdByName = new Map(created.map((actionClass) => [actionClass.name, actionClass.id]));
  for (const [actionClass, sourceIds] of toCreate) {
    const id = createdIdByName.get(actionClass.name);
    if (!id) throw new Error("An action class the import created was not returned");
    for (const sourceId of sourceIds) actionClassIds.set(sourceId, id);
  }
  return actionClassIds;
};

/**
 * The survey's embedded-data fields with its shared ones linked to the target's library, where the
 * library has the same key, source and data type, read in one query. `undefined` when none links, so
 * the create keeps every field the survey's own, which is what it does with the legacy shape alone.
 */
export const linkFormbricksFileSharedFields = async (
  db: TReader,
  {
    workspaceId,
    variables,
    hiddenFields,
    sharedFields,
  }: {
    workspaceId: string;
    variables: TSurveyVariable[];
    hiddenFields: TSurveyHiddenFields;
    sharedFields: TFormbricksFileReferences["embeddedFields"];
  }
): Promise<TLinkedEmbeddedField[] | undefined> => {
  if (sharedFields.length === 0) return undefined;

  const library = await db.embeddedData.findMany({
    where: { workspaceId, surveyId: null, key: { in: sharedFields.map((field) => field.key) } },
    select: {
      id: true,
      key: true,
      name: true,
      source: true,
      dataType: true,
      defaultValue: true,
      locked: true,
    },
  });
  const signature = (field: { key: string | null; source: string; dataType: string }) =>
    `${field.key}|${field.source}|${field.dataType}`;
  const librarySignatures = new Map(library.map((row) => [signature(row), row]));
  const linkByStorageKey = new Map(
    sharedFields.flatMap((field) => {
      const row = librarySignatures.get(signature(field));
      return row ? [[field.storageKey, row] as const] : [];
    })
  );
  if (linkByStorageKey.size === 0) return undefined;

  return embeddedFieldsFromLegacyInput({ variables, hiddenFields }).map((entry) => {
    const row = linkByStorageKey.get(entry.link.storageKey);
    if (!row) return entry;
    return {
      field: {
        id: row.id,
        key: row.key,
        name: row.name,
        source: row.source,
        dataType: row.dataType,
        defaultValue: row.defaultValue,
        locked: row.locked,
      },
      link: entry.link,
    };
  });
};
