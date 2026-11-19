import type { TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";

/*
 * `getNotionDatabases` passes Notion's database objects through as they come, so they carry Notion's
 * own `title` rich text and a property map, which `TIntegrationNotionDatabase` leaves undeclared.
 */
export type TNotionDatabaseProperty = { id: string; name: string; type: string };

// An untitled database has an empty `title`; it is listed and saved with an empty name.
export const getDatabaseTitle = (database: TIntegrationNotionDatabase): string =>
  (database as { title?: { plain_text?: string }[] }).title?.[0]?.plain_text ?? "";

export const getDatabaseProperties = (
  database: TIntegrationNotionDatabase | null | undefined
): Record<string, TNotionDatabaseProperty> => database?.properties ?? {};
