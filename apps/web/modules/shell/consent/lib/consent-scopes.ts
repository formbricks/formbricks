import { type TMcpScopeFamily, parseResourceScope } from "@/modules/shell/connections/lib/scope-families";

/** Identity scopes ride along with every grant and are never offered as a choice. */
const IDENTITY_SCOPES: readonly string[] = ["openid", "profile", "email"];
export const OFFLINE_ACCESS_SCOPE = "offline_access";

export type TConsentGroupId = "surveys_workflows" | "feedback" | "respondent_data" | "integrations_audit";

interface TConsentGroupDefinition {
  id: TConsentGroupId;
  families: readonly TMcpScopeFamily[];
  /** Respondent data: someone's answers or identity, which `surveys:*` never exposes. */
  personalData: boolean;
}

const CONSENT_GROUPS: readonly TConsentGroupDefinition[] = [
  { id: "surveys_workflows", families: ["surveys", "workflows"], personalData: false },
  { id: "feedback", families: ["feedbackRecords"], personalData: false },
  { id: "respondent_data", families: ["responses", "contacts"], personalData: true },
  { id: "integrations_audit", families: ["webhooks", "audit"], personalData: false },
];

/**
 * What is ticked when the screen opens: configuration the agent builds with, read-only where it holds
 * data. Respondent data, webhooks and the audit log start unticked so each is a deliberate choice.
 */
const DEFAULT_SCOPES: readonly string[] = [
  "surveys:read",
  "surveys:write",
  "workflows:read",
  "feedbackRecords:read",
];

export interface TConsentGroup {
  id: TConsentGroupId;
  personalData: boolean;
  /** Requested resource scopes in this group, read before write within a family. */
  scopes: string[];
}

/** The `scope` query parameter is space separated; blanks and repeats are dropped. */
export const parseRequestedScopes = (scope: string | null | undefined): string[] => [
  ...new Set((scope ?? "").split(/\s+/).filter(Boolean)),
];

/** Only what the client asked for is offered: a consent can narrow a request but never widen it. */
export const buildConsentGroups = (requested: readonly string[]): TConsentGroup[] => {
  const asked = new Set(requested);

  return CONSENT_GROUPS.map(({ id, families, personalData }) => ({
    id,
    personalData,
    scopes: families.flatMap((family) =>
      [`${family}:read`, `${family}:write`].filter((scope) => asked.has(scope) && parseResourceScope(scope))
    ),
  })).filter((group) => group.scopes.length > 0);
};

export const getDefaultSelection = (requested: readonly string[]): string[] =>
  buildConsentGroups(requested)
    .flatMap((group) => group.scopes)
    .filter((scope) => DEFAULT_SCOPES.includes(scope));

/**
 * Ticking a write scope also ticks the read of the same family (a client that can change surveys has to
 * be able to read them) and unticking a read unticks the write, so the screen cannot hold a grant that
 * would only half work. A read that was not requested is never added.
 */
export const toggleScope = ({
  selected,
  scope,
  checked,
  requested,
}: {
  selected: readonly string[];
  scope: string;
  checked: boolean;
  requested: readonly string[];
}): string[] => {
  const parsed = parseResourceScope(scope);
  if (!parsed || !requested.includes(scope)) return [...selected];

  const next = new Set(selected);
  const read = `${parsed.family}:read`;
  const write = `${parsed.family}:write`;

  if (checked) {
    next.add(scope);
    if (parsed.level === "write" && requested.includes(read)) next.add(read);
  } else {
    next.delete(scope);
    if (parsed.level === "read") next.delete(write);
  }

  return [...next];
};

export const hasWriteScope = (selected: readonly string[]): boolean =>
  selected.some((scope) => parseResourceScope(scope)?.level === "write");

export const isOfflineAccessRequested = (requested: readonly string[]): boolean =>
  requested.includes(OFFLINE_ACCESS_SCOPE);

/**
 * A grant with no resource scope gives the agent nothing to call, so when the client asked for any, at
 * least one has to stay ticked. A client that asked for none has nothing to choose.
 */
export const canAllowAccess = ({
  requested,
  selected,
}: {
  requested: readonly string[];
  selected: readonly string[];
}): boolean => {
  const askedForResources = requested.some((scope) => parseResourceScope(scope));
  return !askedForResources || selected.some((scope) => parseResourceScope(scope));
};

/**
 * The space-separated `scope` sent to Better Auth's consent endpoint, which accepts a subset of the
 * original request and rejects anything else. Identity scopes the client asked for are always kept;
 * `offline_access` only when ticked; a resource scope only when it was both requested and ticked. A
 * scope this screen does not know is dropped, so nothing is granted that the person was not shown.
 */
export const buildGrantedScope = ({
  requested,
  selected,
  keepAccess,
}: {
  requested: readonly string[];
  selected: readonly string[];
  keepAccess: boolean;
}): string => {
  const ticked = new Set(selected);

  return [
    ...requested.filter((scope) => IDENTITY_SCOPES.includes(scope)),
    ...(keepAccess && isOfflineAccessRequested(requested) ? [OFFLINE_ACCESS_SCOPE] : []),
    ...requested.filter((scope) => parseResourceScope(scope) && ticked.has(scope)),
  ].join(" ");
};
