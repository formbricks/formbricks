import { z } from "zod";
import { ZActionClass } from "@formbricks/types/action-classes";
import { ZContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  ZEmbeddedDataDefaultValue,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";
import {
  V3_SURVEY_MAX_LANGUAGES,
  ZV3CreateSurveyDocument,
  ZV3CreateSurveyDocumentInput,
} from "@/app/api/v3/surveys/schemas";
import {
  FORMBRICKS_FILE_MAX_ACTION_CLASSES,
  FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS,
  FORMBRICKS_FILE_MAX_EMBEDDED_FIELDS,
} from "./limits";

/**
 * The Formbricks file (ADR 0016): a survey's content in a versioned envelope, so a file keeps
 * importing after the v3 survey document it wraps changes. `format` is the file's own integer,
 * independent of the v3 API version; a reader takes every format up to the current one through
 * explicit upgrade steps and refuses newer ones.
 *
 * This module is shared by the export, which writes the current format, and the import, which reads
 * it. Each format's schema stays here once written, so an upgrade step has the shape it starts from.
 */

/** The format this instance writes. */
export const FORMBRICKS_FILE_FORMAT = 1;

/** Every Formbricks file is saved as `<survey name>.formbricks.json`. */
export const FORMBRICKS_FILE_EXTENSION = ".formbricks.json";

/**
 * Where the format's JSON Schema is published with the docs. Each file names it in `$schema`, so an AI
 * assistant editing a file can check its own output. Generated from {@link ZFormbricksFileV1}.
 */
export const FORMBRICKS_FILE_V1_SCHEMA_URL = "https://formbricks.com/docs/schemas/formbricks-file/v1.json";

/**
 * Where the file came from. The survey id is what a later import matches on; the source instance's URL
 * is left out on purpose, since it adds nothing to the match and leaks internal hostnames.
 */
const ZFormbricksFileSource = z
  .object({
    surveyId: z.cuid2().describe("The id of the survey this file was exported from."),
    workspaceId: z.cuid2().describe("The id of the workspace the survey belonged to."),
    updatedAt: z.iso
      .datetime()
      .describe("When the survey was last changed before the export, to detect later edits."),
  })
  .strict();

const ZFormbricksFileMetaV1 = z
  .object({
    format: z.literal(1).describe("The file format. Formbricks refuses a format newer than its own."),
    exportedAt: z.iso.datetime(),
    appVersion: z.string().min(1).describe("The Formbricks version that wrote the file."),
    source: ZFormbricksFileSource,
  })
  .strict()
  .meta({ id: "FormbricksFileMeta" });

/**
 * An action class a trigger in `survey.distribution.triggers` uses, under its source id. An import
 * finds it in the target workspace by key (code actions) or configuration (no-code actions), or
 * creates it.
 */
export const ZFormbricksFileActionClass = ZActionClass.pick({
  id: true,
  name: true,
  description: true,
  type: true,
  key: true,
  noCodeConfig: true,
}).strict();

/** A contact attribute key the survey's targeting filters name. Matched by `key`, else created. */
export const ZFormbricksFileAttributeKey = ZContactAttributeKey.pick({
  key: true,
  name: true,
  description: true,
  dataType: true,
}).strict();

/**
 * A shared embedded-data field (a hidden field or variable from the workspace library) the survey
 * links under `storageKey`, the name its logic and recall use. Matched by `key`, `source` and
 * `dataType`; without a match, an import keeps the field local to the survey.
 */
export const ZFormbricksFileEmbeddedField = z
  .object({
    storageKey: z.string().min(1),
    key: z.string().min(1),
    name: z.string().min(1),
    source: ZEmbeddedDataSource,
    dataType: ZEmbeddedDataType,
    defaultValue: ZEmbeddedDataDefaultValue,
    locked: z.boolean(),
  })
  .strict();

/**
 * A survey language's alias: the workspace's own name for it, which the v3 create body refuses in
 * `survey.languages`. An import matches the language by `code` and gives a language it creates this
 * alias; a language the workspace already has keeps its own.
 */
export const ZFormbricksFileLanguage = z
  .object({
    code: z.string().min(1),
    alias: z.string().min(1),
  })
  .strict();

const ZFormbricksFileReferences = z
  .object({
    actionClasses: z.array(ZFormbricksFileActionClass).max(FORMBRICKS_FILE_MAX_ACTION_CLASSES),
    attributeKeys: z.array(ZFormbricksFileAttributeKey).max(FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS),
    embeddedFields: z.array(ZFormbricksFileEmbeddedField).max(FORMBRICKS_FILE_MAX_EMBEDDED_FIELDS),
    // Optional: only the languages with an alias are listed, and a file may have none.
    languages: z.array(ZFormbricksFileLanguage).max(V3_SURVEY_MAX_LANGUAGES).optional(),
  })
  .strict()
  .meta({
    id: "FormbricksFileReferences",
    description: "What the survey points at outside itself, so it works in a workspace that lacks them.",
  });

/** Format 1. `survey` is the v3 create body without `workspaceId`, element, block, ending and choice ids kept. */
export const ZFormbricksFileV1 = z
  .object({
    $schema: z.string().optional(),
    formbricks: ZFormbricksFileMetaV1,
    survey: ZV3CreateSurveyDocument.meta({ id: "FormbricksFileSurvey" }),
    references: ZFormbricksFileReferences,
  })
  .strict()
  .meta({
    title: "Formbricks file",
    description:
      "A Formbricks survey exported as a file. Import it into any Formbricks workspace, organization or instance.",
  });

/**
 * What a Formbricks file holds besides its envelope metadata: the survey and its references. The
 * dialog sends this back to be created after the review, and the commit reads it with the same rules.
 */
export const ZFormbricksFileContentV1 = ZFormbricksFileV1.pick({ survey: true, references: true });

/**
 * The schemas a file is read with: the published ones, with the survey checked as the create body
 * checks it, so a key the survey document does not know is reported at any depth rather than only at
 * the survey's root.
 */
export const ZFormbricksFileV1Input = ZFormbricksFileV1.extend({ survey: ZV3CreateSurveyDocumentInput });
export const ZFormbricksFileContentV1Input = ZFormbricksFileContentV1.extend({
  survey: ZV3CreateSurveyDocumentInput,
});

export type TFormbricksFileSurveyInput = z.output<typeof ZV3CreateSurveyDocument>;
export type TFormbricksFileMetaV1 = z.infer<typeof ZFormbricksFileMetaV1>;
export type TFormbricksFileReferences = z.infer<typeof ZFormbricksFileReferences>;
export type TFormbricksFileActionClass = z.infer<typeof ZFormbricksFileActionClass>;
export type TFormbricksFileAttributeKey = z.infer<typeof ZFormbricksFileAttributeKey>;
export type TFormbricksFileEmbeddedField = z.infer<typeof ZFormbricksFileEmbeddedField>;
export type TFormbricksFileLanguage = z.infer<typeof ZFormbricksFileLanguage>;

/**
 * The format's JSON Schema, as published with the docs (`docs/schemas/formbricks-file/v1.json`) and
 * named by every file's `$schema`. It describes the input a file may hold, so keys with a default are
 * optional. Refinements JSON Schema cannot express (recall and logic references, language rules) are
 * still checked on import, which names each field it refuses.
 */
export const getFormbricksFileV1JsonSchema = () => {
  const { $schema, ...schema } = z.toJSONSchema(ZFormbricksFileV1, {
    io: "input",
    unrepresentable: "any",
    target: "draft-2020-12",
    // Element types share most of their fields; defining each shared schema once keeps the file small
    // enough for an AI assistant to read.
    reused: "ref",
  });
  return { $schema, $id: FORMBRICKS_FILE_V1_SCHEMA_URL, ...schema };
};
