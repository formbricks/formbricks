/**
 * Strips OAuth credentials out of an integration before it is handed to a client component.
 *
 * The integration settings pages pass the whole integration — including `config.key`, which holds the
 * provider's `access_token` and, for Google Sheets and Airtable, a long-lived `refresh_token` — into
 * `"use client"` wrappers. Anything a client component receives is serialized into the RSC payload and
 * readable in the page source, so those credentials were exposed to every member who could open the
 * page, and to anything with access to that HTML (browser extensions, HAR captures, a shared screen).
 * A refresh token in particular grants access to the connected Google/Airtable account well outside
 * Formbricks, and long after the member's Formbricks access is revoked.
 *
 * The client only needs the non-secret parts: `config.data` (the survey→destination mappings),
 * `config.email`, and a few display/presence fields inside `key` (`bot_id`, `workspace_name`,
 * `team.name`). Secret fields are blanked rather than removed so every consumer stays type-valid.
 */
const REDACTED = "";

const SECRET_KEY_FIELDS = ["access_token", "refresh_token"] as const;

type TIntegrationWithConfig = {
  config?: { key?: Record<string, unknown> | null } | null;
};

export const redactIntegrationCredentials = <T extends TIntegrationWithConfig>(
  integration: T | undefined
): T | undefined => {
  if (!integration?.config?.key || typeof integration.config.key !== "object") {
    return integration;
  }

  const redactedKey: Record<string, unknown> = { ...integration.config.key };
  for (const field of SECRET_KEY_FIELDS) {
    if (field in redactedKey) {
      redactedKey[field] = REDACTED;
    }
  }

  return {
    ...integration,
    config: { ...integration.config, key: redactedKey },
  };
};
