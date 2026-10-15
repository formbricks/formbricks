import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZIntegrationInput } from "@formbricks/types/integration";

/** The integrations a workspace connects through OAuth and configures from its settings. */
export const ZIntegrationTypeParam = z.enum(["googleSheets", "airtable", "notion", "slack"]);
export type TIntegrationTypeParam = z.infer<typeof ZIntegrationTypeParam>;

export const ZIntegrationParams = z.object({ type: ZIntegrationTypeParam }).strict();

export const ZIntegrationWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

export const ZSpreadsheetParams = z
  .object({ type: ZIntegrationTypeParam, spreadsheetId: z.string().min(1) })
  .strict();

/**
 * JSON carries dates as ISO strings; the integration schemas want `Date`s for each mapping's
 * `createdAt`. Revived here, once, rather than loosening the shared schemas.
 */
const reviveMappingDates = (body: unknown): unknown => {
  if (typeof body !== "object" || body === null) return body;
  const config = (body as { config?: { data?: unknown } }).config;
  if (!config || !Array.isArray(config.data)) return body;
  return {
    ...body,
    config: {
      ...config,
      data: config.data.map((entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { createdAt?: unknown }).createdAt === "string"
          ? { ...entry, createdAt: new Date((entry as { createdAt: string }).createdAt) }
          : entry
      ),
    },
  };
};

/**
 * An integration's configuration: its mappings and settings. `config.key` (the OAuth credentials) may be
 * sent but is never trusted — the stored one is kept (see `withStoredIntegrationKey`).
 */
export const ZIntegrationPutBody = z.preprocess(
  reviveMappingDates,
  z.object({ config: z.record(z.string(), z.unknown()) }).strict()
);

/** An integration input — the type from the path, the configuration from the body — validated whole. */
export const parseIntegrationInput = (input: { type: TIntegrationTypeParam; config: unknown }) =>
  ZIntegrationInput.safeParse(input);

export type TIntegrationPutBody = z.input<typeof ZIntegrationPutBody>;

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
