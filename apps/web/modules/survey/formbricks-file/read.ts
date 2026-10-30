import type { z } from "zod";
import { capInvalidParams } from "@/app/api/v3/lib/invalid-params";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import { formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { collectV3TargetingAttributeKeys } from "@/app/api/v3/surveys/targeting";
import { SurveyImportFileTooLargeError, SurveyImportInputError } from "@/modules/survey/import/core/errors";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import {
  FORMBRICKS_FILE_FORMAT,
  type TFormbricksFileReferences,
  type TFormbricksFileSource,
  type TFormbricksFileSurveyInput,
  ZFormbricksFileContentV1Input,
  ZFormbricksFileV1Input,
} from "./envelope";
import {
  FORMBRICKS_FILE_MAX_REPORTED_DROPPED_KEYS,
  FORMBRICKS_FILE_MAX_SURVEY_BYTES,
  FORMBRICKS_FILE_MAX_UNKNOWN_KEY_PASSES,
} from "./limits";

/**
 * Reading a Formbricks file (ADR 0016): the format probe, the upgrade steps up to the current format,
 * and the first two of the import's three validation tiers (ENG-6850):
 *
 * 1. malformed input — a shape the format does not allow, a broken logic or recall reference, a format
 *    newer than this instance's — is refused with `invalid_params` naming each field, before anything
 *    else runs;
 * 2. keys the format does not know are dropped, one report warning each, so a key an AI assistant
 *    invented while editing the file does not block the import.
 *
 * The third tier, the parts the target workspace cannot hold, needs the workspace and lives with the
 * import (`fit.ts`). Pure: no I/O, so the preview and the commit read a file the same way.
 */

/** A Formbricks file's content, read and upgraded to the current format. */
export interface TFormbricksFileContent {
  /**
   * The survey as the v3 create request body takes it — locale-keyed texts, before parsing fills
   * defaults — with every unknown key dropped. No `workspaceId`: the import names the target.
   */
  survey: Record<string, unknown>;
  references: TFormbricksFileReferences;
}

export interface TFormbricksFileRead {
  content: TFormbricksFileContent;
  /**
   * Where an uploaded file came from: the survey it was exported from, which a later import matches
   * (ENG-6851). `null` for a reviewed survey sent back to be written, which carries no envelope.
   */
  source: TFormbricksFileSource | null;
  /** One `unknown_key_dropped` warning per key dropped. */
  issues: TSurveyImportPipelineIssue[];
}

/**
 * A step from one format to the next, keyed by the format it reads. Format 1 is the first, so there is
 * none yet; the step written alongside format 2 turns a format 1 file into a format 2 one.
 */
export type TFormbricksFileUpgradeStep = (file: Record<string, unknown>) => Record<string, unknown>;

export const FORMBRICKS_FILE_UPGRADE_STEPS: Readonly<Record<number, TFormbricksFileUpgradeStep>> = {};

const INVALID_MESSAGE = "The Formbricks file is not valid.";

const refuseFile = (invalidParams: InvalidParam[]): SurveyImportInputError =>
  new SurveyImportInputError(invalidParams, INVALID_MESSAGE, "formbricks_file_invalid");

/**
 * The file's format: a whole number from 1. A newer one than this instance writes is refused with its
 * own problem code, so the dialog can say to update Formbricks rather than to fix the file.
 */
const probeFormat = (file: Record<string, unknown>): number => {
  const format = isPlainObject(file.formbricks) ? file.formbricks.format : undefined;
  if (typeof format !== "number" || !Number.isSafeInteger(format) || format < 1) {
    throw refuseFile([
      { name: "file.formbricks.format", reason: "Expected the file format, a whole number from 1" },
    ]);
  }
  if (format > FORMBRICKS_FILE_FORMAT) {
    throw new SurveyImportInputError(
      [
        {
          name: "file.formbricks.format",
          reason: `This file is format ${format}; this version of Formbricks reads formats up to ${FORMBRICKS_FILE_FORMAT}`,
          identifier: String(format),
        },
      ],
      "The Formbricks file was written by a newer version of Formbricks.",
      "formbricks_file_too_new"
    );
  }
  return format;
};

/**
 * Bring a file of an older format up to `to`, one step at a time. A format with no step to the next is
 * a bug in this table, not in the file, so it throws a plain error.
 */
export const upgradeFormbricksFile = (
  file: Record<string, unknown>,
  {
    from,
    to = FORMBRICKS_FILE_FORMAT,
    steps = FORMBRICKS_FILE_UPGRADE_STEPS,
  }: { from: number; to?: number; steps?: Readonly<Record<number, TFormbricksFileUpgradeStep>> }
): Record<string, unknown> => {
  let upgraded = file;
  for (let format = from; format < to; format++) {
    const step = steps[format];
    if (!step) throw new Error(`No upgrade step from Formbricks file format ${format}`);
    upgraded = step(upgraded);
  }
  return upgraded;
};

/**
 * The key a Zod issue says is unknown, as a path from the root, or `null` for any other issue. Strict
 * objects report their unknown keys together (`unrecognized_keys`); the v3 survey document reports
 * each as a custom `unsupported_field` issue at the key itself.
 */
const unknownKeyPaths = (issue: z.core.$ZodIssue): PropertyKey[][] => {
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => [...issue.path, key]);
  }
  const params = issue.code === "custom" && isPlainObject(issue.params) ? issue.params : null;
  return params?.code === "unsupported_field" && issue.path.length > 0 ? [[...issue.path]] : [];
};

/** Delete the key at `path`; `false` when the path no longer leads to it. */
const deleteAtPath = (root: unknown, path: readonly PropertyKey[]): boolean => {
  let parent: unknown = root;
  for (const segment of path.slice(0, -1)) {
    if (typeof parent !== "object" || parent === null) return false;
    parent = (parent as Record<PropertyKey, unknown>)[segment];
  }
  const key = path.at(-1);
  if (!isPlainObject(parent) || key === undefined || !Object.hasOwn(parent, key)) return false;
  delete parent[key as string];
  return true;
};

/**
 * Parse `value` with `schema`, dropping every key the schema does not know until none is left. Each
 * pass drops what the last parse reported, so an unknown key inside an object that was itself
 * misplaced is reached once the outer one is gone; the passes are capped, and what is still wrong
 * after them is malformed input.
 */
const parseDroppingUnknownKeys = <TSchema extends z.ZodType>(
  schema: TSchema,
  value: Record<string, unknown>
): { result: z.ZodSafeParseResult<z.output<TSchema>>; value: Record<string, unknown>; dropped: string[] } => {
  const copy = structuredClone(value);
  const dropped: string[] = [];

  let result = schema.safeParse(copy);
  for (let pass = 0; !result.success && pass < FORMBRICKS_FILE_MAX_UNKNOWN_KEY_PASSES; pass++) {
    let droppedThisPass = false;
    for (const issue of result.error.issues) {
      for (const path of unknownKeyPaths(issue)) {
        if (deleteAtPath(copy, path)) {
          dropped.push(path.map(String).join("."));
          droppedThisPass = true;
        }
      }
    }
    if (!droppedThisPass) break;
    result = schema.safeParse(copy);
  }

  return { result, value: copy, dropped };
};

/** One warning per dropped key, the first few by name and the rest counted, so a file cannot flood the report. */
const droppedKeyIssues = (dropped: readonly string[]): TSurveyImportPipelineIssue[] => {
  const named = dropped.slice(0, FORMBRICKS_FILE_MAX_REPORTED_DROPPED_KEYS);
  const issues: TSurveyImportPipelineIssue[] = named.map((path) => ({
    code: "unknown_key_dropped",
    severity: "warning",
    params: { field: path },
  }));
  if (dropped.length > named.length) {
    issues.push({
      code: "unknown_key_dropped",
      severity: "warning",
      params: { count: dropped.length - named.length },
    });
  }
  return issues;
};

/** Where a problem is, from the root the caller names: the file (`file.…`), or the request body as it is. */
const at = (prefix: string | null, path: string): string => (prefix ? `${prefix}.${path}` : path);

const withPrefix = (params: InvalidParam[], prefix: string | null): InvalidParam[] =>
  prefix
    ? params.map((param) => ({ ...param, name: param.name === prefix ? prefix : at(prefix, param.name) }))
    : params;

/**
 * What the format allows but a survey cannot use: a trigger whose action class the file does not
 * carry, a targeting filter naming an attribute key the file does not carry. Without its definition
 * the import has nothing to match or create, so the file is malformed.
 */
const findDanglingReferences = (
  survey: TFormbricksFileSurveyInput,
  references: TFormbricksFileReferences,
  prefix: string | null
): InvalidParam[] => {
  const invalidParams: InvalidParam[] = [];

  const actionClassIds = new Set(references.actionClasses.map((actionClass) => actionClass.id));
  (survey.distribution?.triggers ?? []).forEach(({ actionClassId }, index) => {
    if (!actionClassIds.has(actionClassId)) {
      invalidParams.push({
        name: at(prefix, `survey.distribution.triggers.${index}.actionClassId`),
        reason: "The action class this trigger uses is not in references.actionClasses",
        code: "dangling_reference",
        identifier: actionClassId,
      });
    }
  });

  const attributeKeys = new Set(references.attributeKeys.map((attributeKey) => attributeKey.key));
  for (const key of collectV3TargetingAttributeKeys(survey.targeting?.filters ?? [])) {
    if (!attributeKeys.has(key)) {
      invalidParams.push({
        name: at(prefix, "survey.targeting.filters"),
        reason: `The attribute key '${key}' a filter names is not in references.attributeKeys`,
        code: "dangling_reference",
        identifier: key,
      });
    }
  }

  return invalidParams;
};

const readContent = (
  schema: typeof ZFormbricksFileV1Input | typeof ZFormbricksFileContentV1Input,
  input: Record<string, unknown>,
  prefix: string | null
): TFormbricksFileRead => {
  // Before the parse, which is where a large survey costs: the survey becomes a draft no larger than this.
  if (Buffer.byteLength(JSON.stringify(input.survey ?? null)) > FORMBRICKS_FILE_MAX_SURVEY_BYTES) {
    throw new SurveyImportFileTooLargeError(
      "survey_size",
      `The survey must not exceed ${FORMBRICKS_FILE_MAX_SURVEY_BYTES} bytes as JSON`,
      at(prefix, "survey")
    );
  }

  const { result, value, dropped } = parseDroppingUnknownKeys(schema, input);
  const fallbackName = prefix ?? "body";
  if (!result.success) {
    throw refuseFile(
      capInvalidParams(
        withPrefix(formatV3ZodInvalidParams(result.error, fallbackName), prefix),
        fallbackName,
        "file"
      )
    );
  }

  const { survey, references } = result.data;
  const dangling = findDanglingReferences(survey, references, prefix);
  if (dangling.length > 0) throw refuseFile(capInvalidParams(dangling, fallbackName, "file"));

  return {
    content: { survey: isPlainObject(value.survey) ? value.survey : {}, references },
    source: "formbricks" in result.data ? result.data.formbricks.source : null,
    issues: droppedKeyIssues(dropped),
  };
};

/**
 * Read an uploaded Formbricks file: probe its format, refuse a newer one, upgrade an older one, and
 * check it against the current format with unknown keys dropped. Problems are named from the file's
 * root (`file.survey.blocks.0.elements.1.headline`).
 *
 * @throws SurveyImportInputError — a 422 naming each field, nothing created.
 */
export const readFormbricksFile = (file: Record<string, unknown>): TFormbricksFileRead => {
  const format = probeFormat(file);
  const upgraded = upgradeFormbricksFile(file, { from: format });
  return readContent(ZFormbricksFileV1Input, upgraded, "file");
};

/**
 * Read a reviewed survey and its references again, as the dialog sends them to be created: the commit
 * never trusts what the preview resolved, so it runs the same checks. Problems are named from the
 * request body's root (`survey.blocks.0…`).
 *
 * @throws SurveyImportInputError — a 422 naming each field, nothing created.
 */
export const readFormbricksFileContent = (body: Record<string, unknown>): TFormbricksFileRead =>
  readContent(ZFormbricksFileContentV1Input, body, null);
