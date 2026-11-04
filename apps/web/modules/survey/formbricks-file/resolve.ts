import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { formatSnakeCaseToTitleCase, isSafeIdentifier } from "@formbricks/types/safe-identifier";
import type { TSurveyHiddenFields, TSurveyVariable } from "@formbricks/types/surveys/types";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@/lib/constants";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import {
  RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE,
  isReservedFutureDefaultAttributeKey,
} from "@/modules/ee/contacts/lib/attribute-key-policy";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import {
  type TTranslate,
  getImportedName,
  importedNamePrefix,
} from "@/modules/survey/import/core/imported-name";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import { SURVEY_IMPORT_MAX_TAKEN_NAMES } from "@/modules/survey/import/limits";
import type {
  TFormbricksFileActionClass,
  TFormbricksFileAttributeKey,
  TFormbricksFileLanguage,
  TFormbricksFileReferences,
} from "./envelope";

/**
 * The reference resolver of a Formbricks file import (ADR 0023, ENG-6850): what the survey points at
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
            .sort((a, b) => a.localeCompare(b))
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

/** Where a reference sits, from the root the caller names: the file (`file.…`), or the request body. */
const at = (prefix: string | null, path: string): string => (prefix ? `${prefix}.${path}` : path);

/** Why a new attribute key cannot be created, as the other create paths say it, or `null` when it can. */
const attributeKeyRefusal = (key: string): string | null => {
  if (!isSafeIdentifier(key)) {
    return "A new attribute key must be a safe identifier: lowercase letters, numbers and underscores, starting with a letter";
  }
  if (isReservedFutureDefaultAttributeKey(key))
    return RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE;
  return null;
};

/** Refuse an import whose new attribute keys would take the workspace past the cap. */
const assertAttributeKeyCap = (count: number, adding: number, fieldPrefix: string | null): void => {
  if (count + adding <= MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) return;
  throw new SurveyImportInputError(
    [
      {
        name: at(fieldPrefix, "references.attributeKeys"),
        reason: `Importing this survey adds ${adding} attribute keys, past the ${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT} a workspace can have`,
        code: "limit_exceeded",
      },
    ],
    "The workspace cannot hold the attribute keys this survey needs.",
    "formbricks_file_invalid"
  );
};

/**
 * Rows in the order of their unique key, so two imports inserting overlapping rows take the key's locks in
 * the same order and one waits for the other, instead of each holding a row the other needs (a deadlock,
 * answered with a 500).
 */
const inUniqueKeyOrder = <T>(rows: readonly T[], keyOf: (row: T) => string): T[] =>
  [...rows].sort((a, b) => {
    const left = keyOf(a);
    const right = keyOf(b);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });

/**
 * Serializes the imports that create attribute keys in one workspace, so two cannot both pass the cap's
 * count and together go past it. Taken in the import's transaction, released when it ends.
 */
const ATTRIBUTE_KEY_CAP_LOCK_PREFIX = "survey-import:attribute-keys:";

/**
 * The attribute keys the survey's targeting uses, out of all the file lists (`fileKeys`, which a refusal
 * indexes into, so it names the entry in the file): matched in the workspace, else created.
 */
const planAttributeKeys = async (
  db: TReader,
  workspaceId: string,
  { fileKeys, usedKeys }: { fileKeys: TFormbricksFileAttributeKey[]; usedKeys: ReadonlySet<string> },
  fieldPrefix: string | null
): Promise<Pick<TFormbricksFileReferencePlan, "attributeKeysToCreate" | "issues">> => {
  const wanted = fileKeys.filter((attributeKey) => usedKeys.has(attributeKey.key));
  if (wanted.length === 0) return { attributeKeysToCreate: [], issues: [] };

  const [existing, count] = await Promise.all([
    db.contactAttributeKey.findMany({
      where: { workspaceId, key: { in: wanted.map((attributeKey) => attributeKey.key) } },
      select: { key: true },
    }),
    db.contactAttributeKey.count({ where: { workspaceId } }),
  ]);
  const existingKeys = new Set(existing.map((attributeKey) => attributeKey.key));
  // A file may name one key more than once; its first definition is the one it is created with (as an
  // action class's is), so the insert cannot fail on the key's unique constraint with a 500.
  const wantedByKey = new Map<string, TFormbricksFileAttributeKey>();
  for (const attributeKey of wanted) {
    if (!wantedByKey.has(attributeKey.key)) wantedByKey.set(attributeKey.key, attributeKey);
  }
  const attributeKeysToCreate = [...wantedByKey.values()].filter(
    (attributeKey) => !existingKeys.has(attributeKey.key)
  );

  // A key the workspace has is linked whatever it is called; a new one is held to the rules every other
  // way of creating a key holds it to.
  const refused = attributeKeysToCreate.flatMap((attributeKey) => {
    const reason = attributeKeyRefusal(attributeKey.key);
    if (!reason) return [];
    const index = fileKeys.indexOf(attributeKey);
    return [{ name: at(fieldPrefix, `references.attributeKeys.${index}.key`), reason }];
  });
  if (refused.length > 0) {
    throw new SurveyImportInputError(
      refused,
      "The survey needs attribute keys the workspace cannot create.",
      "formbricks_file_invalid"
    );
  }

  assertAttributeKeyCap(count, attributeKeysToCreate.length, fieldPrefix);

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
    planAttributeKeys(db, workspaceId, { fileKeys: references.attributeKeys, usedKeys: keys }, fieldPrefix),
    planLanguages(db, workspaceId, survey, references.languages ?? []),
  ]);

  return {
    actionClasses: actions.actionClasses,
    attributeKeysToCreate: attributeKeys.attributeKeysToCreate,
    languagesToCreate,
    issues: [...actions.issues, ...attributeKeys.issues],
  };
};

/** What an import created in the target besides the survey, for its audit entry. */
export interface TFormbricksFileCreatedReferences {
  actionClasses: { id: string; name: string }[];
  attributeKeys: string[];
  languages: string[];
}

/** What makes a planned action class and a stored one the same one: its type and key, or its configuration. */
const actionClassIdentity = (actionClass: {
  type: "code" | "noCode";
  key: string | null;
  noCodeConfig: unknown;
}): string =>
  actionClass.type === "code"
    ? `code:${actionClass.key ?? ""}`
    : `noCode:${canonicalJson(actionClass.noCodeConfig ?? null)}`;

const workspaceChangedError = (name: string) =>
  new SurveyImportInputError(
    [
      {
        name: "references.actionClasses",
        reason: `Another import created the action class "${name}" while this one ran; import the file again`,
      },
    ],
    "The workspace changed while the file was being imported.",
    "formbricks_file_invalid"
  );

/**
 * The action classes a concurrent create took, by identity: the insert skipped them, and only a row
 * that is the one this plan means may be linked. A same-named row of another key or configuration is
 * another action class, so it is not returned and the caller refuses rather than link the wrong one.
 */
const recoverSkippedActionClasses = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  missing: readonly TActionClassCreate[]
): Promise<Map<string, string>> => {
  const existing = await tx.actionClass.findMany({
    where: {
      workspaceId,
      OR: [
        { name: { in: missing.map((actionClass) => actionClass.name) } },
        { key: { in: missing.flatMap((actionClass) => (actionClass.key ? [actionClass.key] : [])) } },
      ],
    },
    select: { id: true, type: true, key: true, noCodeConfig: true },
  });
  const wanted = new Set(missing.map(actionClassIdentity));
  const idByIdentity = new Map<string, string>();
  for (const actionClass of existing) {
    const identity = actionClassIdentity(actionClass);
    if (wanted.has(identity)) idByIdentity.set(identity, actionClass.id);
  }
  return idByIdentity;
};

/**
 * Create the plan's attribute keys, the cap held again under a lock: the plan counted before this
 * transaction, and another import may have added keys since. A key without a name is named after itself,
 * as the other create paths name it.
 */
const createAttributeKeys = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  attributeKeys: TFormbricksFileAttributeKey[]
) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ATTRIBUTE_KEY_CAP_LOCK_PREFIX + workspaceId}))`;
  assertAttributeKeyCap(
    await tx.contactAttributeKey.count({ where: { workspaceId } }),
    attributeKeys.length,
    null
  );
  return tx.contactAttributeKey.createManyAndReturn({
    data: inUniqueKeyOrder(attributeKeys, ({ key }) => key).map((attributeKey) => ({
      workspaceId,
      ...attributeKey,
      name: attributeKey.name ?? formatSnakeCaseToTitleCase(attributeKey.key),
    })),
    select: { key: true },
    skipDuplicates: true,
  });
};

/** Create what the plan says is missing, one query per kind; the rows this transaction inserted come back. */
const createMissingReferences = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  plan: TFormbricksFileReferencePlan,
  creates: readonly TActionClassCreate[]
) => {
  const [actionClasses, attributeKeys, languages] = await Promise.all([
    creates.length > 0
      ? tx.actionClass.createManyAndReturn({
          data: inUniqueKeyOrder(creates, (actionClass) => actionClass.name).map((actionClass) => ({
            workspaceId,
            name: actionClass.name,
            description: actionClass.description,
            type: actionClass.type,
            key: actionClass.type === "code" ? actionClass.key : null,
            noCodeConfig: actionClass.noCodeConfig ?? undefined,
          })),
          select: { id: true, name: true },
          // A concurrent import may create the same one between the plan's read and this insert.
          skipDuplicates: true,
        })
      : Promise.resolve([]),
    plan.attributeKeysToCreate.length > 0
      ? createAttributeKeys(tx, workspaceId, plan.attributeKeysToCreate)
      : Promise.resolve([]),
    plan.languagesToCreate.length > 0
      ? tx.language.createManyAndReturn({
          data: inUniqueKeyOrder(plan.languagesToCreate, ({ code }) => code).map(({ code, alias }) => ({
            workspaceId,
            code,
            alias,
          })),
          select: { code: true },
          skipDuplicates: true,
        })
      : Promise.resolve([]),
  ]);
  return { actionClasses, attributeKeys, languages };
};

/**
 * Create what the plan says is missing, in the caller's transaction, one query per kind. Returns the
 * target id of every action class the survey's triggers name, by its id in the file, and what this
 * transaction created — a row another transaction took first is linked, not claimed.
 */
export const applyFormbricksFileReferences = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  plan: TFormbricksFileReferencePlan
): Promise<{ actionClassIds: Map<string, string>; created: TFormbricksFileCreatedReferences }> => {
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
  const { actionClasses, attributeKeys, languages } = await createMissingReferences(
    tx,
    workspaceId,
    plan,
    creates
  );

  const insertedByName = new Map(actionClasses.map(({ id, name }) => [name, id]));
  const missing = creates.filter((actionClass) => !insertedByName.has(actionClass.name));
  const recovered =
    missing.length > 0
      ? await recoverSkippedActionClasses(tx, workspaceId, missing)
      : new Map<string, string>();

  for (const [actionClass, sourceIds] of toCreate) {
    const id = insertedByName.get(actionClass.name) ?? recovered.get(actionClassIdentity(actionClass));
    if (!id) throw workspaceChangedError(actionClass.name);
    for (const sourceId of sourceIds) actionClassIds.set(sourceId, id);
  }
  return {
    actionClassIds,
    created: {
      actionClasses,
      // Sorted: the order `INSERT … RETURNING` gives is not promised, and nothing reads it.
      attributeKeys: attributeKeys.map(({ key }) => key).sort((a, b) => a.localeCompare(b)),
      languages: languages.map(({ code }) => code).sort((a, b) => a.localeCompare(b)),
    },
  };
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
