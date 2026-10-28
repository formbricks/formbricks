/**
 * The resource families the MCP server grants access to, in the order every summary lists them.
 * A scope is `<family>:<level>` (`surveys:read`); `audit` only has a read level.
 */
export const MCP_SCOPE_FAMILIES = [
  "surveys",
  "workflows",
  "feedbackRecords",
  "responses",
  "contacts",
  "webhooks",
  "audit",
] as const;

export type TMcpScopeFamily = (typeof MCP_SCOPE_FAMILIES)[number];
export type TMcpScopeLevel = "read" | "write";

export interface TParsedResourceScope {
  family: TMcpScopeFamily;
  level: TMcpScopeLevel;
}

const isFamily = (value: string): value is TMcpScopeFamily =>
  (MCP_SCOPE_FAMILIES as readonly string[]).includes(value);

/** `null` for identity scopes (`openid`, `offline_access`, ...) and anything unknown. */
export const parseResourceScope = (scope: string): TParsedResourceScope | null => {
  const [family, level, ...rest] = scope.split(":");
  if (rest.length > 0 || !isFamily(family) || (level !== "read" && level !== "write")) {
    return null;
  }
  if (family === "audit" && level === "write") {
    return null;
  }
  return { family, level };
};

export interface TAccessSummary {
  /** Families the connection can change (write includes read). */
  write: TMcpScopeFamily[];
  /** Families it can only read. */
  readOnly: TMcpScopeFamily[];
}

/** Collapses a scope list into "can write" and "can only read" family lists, in display order. */
export const summarizeScopes = (scopes: readonly string[]): TAccessSummary => {
  const canWrite = new Set<TMcpScopeFamily>();
  const canRead = new Set<TMcpScopeFamily>();

  for (const scope of scopes) {
    const parsed = parseResourceScope(scope);
    if (!parsed) continue;
    (parsed.level === "write" ? canWrite : canRead).add(parsed.family);
  }

  return {
    write: MCP_SCOPE_FAMILIES.filter((family) => canWrite.has(family)),
    readOnly: MCP_SCOPE_FAMILIES.filter((family) => canRead.has(family) && !canWrite.has(family)),
  };
};

/** Every key is spelled out: `scan-translations` does not follow keys built from a family name. */
export const getScopeFamilyLabel = (family: TMcpScopeFamily, t: (key: string) => string): string => {
  switch (family) {
    case "surveys":
      return t("shell.connections.families.surveys");
    case "workflows":
      return t("shell.connections.families.workflows");
    case "feedbackRecords":
      return t("shell.connections.families.feedback_records");
    case "responses":
      return t("shell.connections.families.responses");
    case "contacts":
      return t("shell.connections.families.contacts");
    case "webhooks":
      return t("shell.connections.families.webhooks");
    case "audit":
      return t("shell.connections.families.audit");
  }
};
