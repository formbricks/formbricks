import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationType } from "@formbricks/types/integration";
import type { TIntegrationAirtableConfigData } from "@formbricks/types/integration/airtable";
import type { TIntegrationGoogleSheetsConfigData } from "@formbricks/types/integration/google-sheet";
import type { TIntegrationNotionConfigData } from "@formbricks/types/integration/notion";
import type { TIntegrationSlackConfigData } from "@formbricks/types/integration/slack";

/** The integrations a workspace connects through OAuth and configures from its settings: all but n8n. */
export const ZIntegrationTypeParam = ZIntegrationType.exclude(["n8n"]);
export type TIntegrationTypeParam = z.infer<typeof ZIntegrationTypeParam>;

export const ZIntegrationParams = z.object({ type: ZIntegrationTypeParam }).strict();

export const ZIntegrationWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

/**
 * Longest text a mapping field may carry: names, ids and labels from the survey and the provider. Far
 * above any real one (provider ids are tens of characters), and the request's own array and size limits
 * bound how many of them a body holds.
 */
export const INTEGRATION_MAPPING_TEXT_MAX_LENGTH = 5_000;

const NULL_CHARACTER = String.fromCodePoint(0);

/** PostgreSQL stores no `jsonb` string holding U+0000, so one would fail the write with a 500. */
const ZMappingText = z
  .string()
  .max(INTEGRATION_MAPPING_TEXT_MAX_LENGTH)
  .refine((value) => !value.includes(NULL_CHARACTER), "Text must not contain NULL bytes");

export const ZSpreadsheetParams = z
  .object({
    type: ZIntegrationTypeParam,
    spreadsheetId: z.string().min(1).max(INTEGRATION_MAPPING_TEXT_MAX_LENGTH),
  })
  .strict();

/** JSON carries the mapping's timestamp as an ISO string; the stored integration keeps a `Date`. */
const ZMappingCreatedAt = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

/** What every mapping names: the survey it forwards and which of its data goes along. */
const surveyMappingShape = {
  createdAt: ZMappingCreatedAt,
  surveyId: ZMappingText,
  surveyName: ZMappingText,
  includeVariables: z.boolean().optional(),
  includeHiddenFields: z.boolean().optional(),
  includeMetadata: z.boolean().optional(),
  includeCreatedAt: z.boolean().optional(),
  includeContactAttributes: z.boolean().optional(),
};

/** The survey elements a row-shaped destination (a sheet, a table, a channel) receives. */
const elementSelectionShape = {
  elementIds: z.array(ZMappingText),
  elements: ZMappingText,
};

const ZNotionField = z.strictObject({ id: ZMappingText, name: ZMappingText, type: ZMappingText });

/**
 * One mapping of each integration type, as the settings pages send it: the survey→destination link and
 * nothing else. Strict at every level, so a typo or a field the server owns is a 400 instead of being
 * dropped.
 */
export const ZIntegrationMappingBody = {
  googleSheets: z.strictObject({
    ...surveyMappingShape,
    ...elementSelectionShape,
    spreadsheetId: ZMappingText,
    spreadsheetName: ZMappingText,
  }),
  airtable: z.strictObject({
    ...surveyMappingShape,
    ...elementSelectionShape,
    baseId: ZMappingText,
    tableId: ZMappingText,
    tableName: ZMappingText,
  }),
  notion: z.strictObject({
    ...surveyMappingShape,
    databaseId: ZMappingText,
    databaseName: ZMappingText,
    mapping: z.array(z.strictObject({ element: ZNotionField, column: ZNotionField })),
  }),
  slack: z.strictObject({
    ...surveyMappingShape,
    ...elementSelectionShape,
    channelId: ZMappingText,
    channelName: ZMappingText,
  }),
} satisfies Record<TIntegrationTypeParam, z.ZodType>;

/**
 * `PUT /api/internal/integrations/{type}`'s body, by type: `config.data`, the mappings, is the only part of
 * an integration a client configures. The credentials (`config.key`) and the connected account
 * (`config.email`) come from the OAuth callback alone, so a body naming either is refused.
 */
const putBodyFor = <T extends TIntegrationTypeParam>(type: T) =>
  z.strictObject({ config: z.strictObject({ data: z.array(ZIntegrationMappingBody[type]) }) });

export const ZIntegrationPutBodyByType = {
  googleSheets: putBodyFor("googleSheets"),
  airtable: putBodyFor("airtable"),
  notion: putBodyFor("notion"),
  slack: putBodyFor("slack"),
} satisfies Record<TIntegrationTypeParam, z.ZodType>;

/**
 * The PUT body's envelope, as the route checks it before the type is known. The operation then parses
 * the whole body with {@link ZIntegrationPutBodyByType} for the type in the path.
 */
export const ZIntegrationPutBody = z.strictObject({ config: z.record(z.string(), z.unknown()) });
export type TIntegrationPutBody = z.infer<typeof ZIntegrationPutBody>;

/** The mappings the settings pages hold, by type, as the integration types define them. */
export type TIntegrationMappingsByType = {
  googleSheets: TIntegrationGoogleSheetsConfigData;
  airtable: TIntegrationAirtableConfigData;
  notion: TIntegrationNotionConfigData;
  slack: TIntegrationSlackConfigData;
};

type TMappingBodyMatchesStoredType = {
  [K in TIntegrationTypeParam]: z.output<
    (typeof ZIntegrationMappingBody)[K]
  > extends TIntegrationMappingsByType[K]
    ? true
    : false;
};
type TAllTrue<T extends true> = T;

/**
 * Compile-time tie between these body schemas and the shared integration types: a mapping the PUT
 * accepts must be a valid stored mapping, so a field the shared type adds or makes required fails the
 * build here instead of drifting.
 */
export type TIntegrationMappingBodiesMatchStoredTypes = TAllTrue<
  TMappingBodyMatchesStoredType[TIntegrationTypeParam]
>;

const pickShape = (schema: z.ZodObject, value: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.keys(schema.shape)
      .filter((field) => field in value)
      .map((field) => [field, (value as Record<string, unknown>)[field]])
  );

/**
 * A mapping reduced to the fields the PUT accepts. The page's mappings come from the stored integration,
 * which may carry fields an older release wrote; sending those back would be refused by the strict body.
 */
export const toIntegrationMappingBody = <T extends TIntegrationTypeParam>(
  type: T,
  mapping: TIntegrationMappingsByType[T]
): Record<string, unknown> => {
  const body = pickShape(ZIntegrationMappingBody[type], mapping);
  if (type === "notion") {
    body.mapping = (mapping as TIntegrationNotionConfigData).mapping.map(({ element, column }) => ({
      element: pickShape(ZNotionField, element),
      column: pickShape(ZNotionField, column),
    }));
  }
  return body;
};

/** Whether a Google Sheets grant still works: what decides whether the page offers to reconnect. */
export type TIntegrationConnectionResource = {
  status: "connected" | "not_connected" | "reauthorization_required";
};

/**
 * Why a provider read was refused, in a 409's `details.reason`: the integration isn't connected, its
 * grant has to be renewed, or (Google Sheets) the grant can't reach the spreadsheet.
 */
export type TIntegrationConflictReason =
  | "not_connected"
  | "reauthorization_required"
  | "invalid_grant"
  | "insufficient_permission"
  | "insufficient_scopes";
