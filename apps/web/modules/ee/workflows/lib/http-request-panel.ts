import {
  type TSendWorkflowTestRequestInput,
  type TWorkflowDefinition,
  type TWorkflowHttpHeader,
  type TWorkflowHttpRequestActionConfig,
  type TWorkflowStatus,
  type TWorkflowUrlTemplateIssue,
  WORKFLOW_HTTP_METHODS_WITH_BODY,
  findWorkflowUrlTemplateIssue,
  getWorkflowOriginHost,
  getWorkflowUrlOrigin,
  isDefaultSecretHeaderName,
  isWorkflowUrlPathPosition,
} from "@formbricks/workflows";

/**
 * The HTTP request panel's logic (ENG-7182), pure so it is tested here and the form only draws it.
 * Header shapes follow the API (ADR 0043): plain `{name, value}`; a stored secret reads
 * `{name, secret: true, isSet, boundOrigin?}` and is written back as is to keep it; a new or replaced
 * secret is written once as `{name, secret: true, value}`. A stored value is only sent to its
 * `boundOrigin` (ADR 0051).
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const parseUrl = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/** The step card's summary: "POST dl.acme.example/interactions"; null until the URL parses. */
export const describeHttpRequestTarget = (
  config: Pick<TWorkflowHttpRequestActionConfig, "method" | "url">
): string | null => {
  const url = parseUrl(config.url.trim());
  if (!url) return null;
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${config.method} ${url.host}${path}`;
};

/**
 * A plain-HTTP URL that will be refused unless the instance allows it (spec §4): `http:` anywhere
 * but localhost, which always works.
 */
export const isPlainHttpUrl = (url: string): boolean => {
  const parsed = parseUrl(url.trim());
  return parsed?.protocol === "http:" && !LOCAL_HOSTNAMES.has(parsed.hostname);
};

/**
 * Why the URL's Variables are where saving refuses them (ADR 0053): before the path (scheme, host or
 * port), in the query or fragment, or not a Variable at all. Null when the URL has none or all sit in
 * the path. The panel says so before saving does.
 */
export const getUrlVariableIssue = (url: string): TWorkflowUrlTemplateIssue | null =>
  findWorkflowUrlTemplateIssue(url);

/** Whether `@` typed after `textBefore` may insert a Variable: only in the path, after the host. */
export const canInsertUrlVariableAt = (textBefore: string): boolean => isWorkflowUrlPathPosition(textBefore);

/** Whether the method sends the JSON body; GET and DELETE never do. */
export const methodSendsBody = (method: TWorkflowHttpRequestActionConfig["method"]): boolean =>
  WORKFLOW_HTTP_METHODS_WITH_BODY.has(method);

/** A Test request response body as the panel shows it: text as is, JSON pretty-printed. */
export const formatResponseBody = (body: unknown): string => {
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2) ?? "";
};

/** The stored body: blank text means no body. */
export const toStoredBody = (text: string): string | null => (text.trim() === "" ? null : text);

export type THeaderRowKind =
  /** Value shown and editable. */
  | "plain"
  /** A secret with a stored value: masked, with Replace. */
  | "secret_set"
  /** A secret whose value is being typed (new, or replacing the stored one). */
  | "secret_value"
  /** A secret with no value yet, e.g. after a duplicate: it needs one before Enable. */
  | "secret_missing";

export const getHeaderRowKind = (header: TWorkflowHttpHeader): THeaderRowKind => {
  if (header.secret !== true) return "plain";
  if (header.value !== undefined) return "secret_value";
  return header.isSet ? "secret_set" : "secret_missing";
};

/**
 * The host a stored secret's value is still sent to when the step's URL now points at another origin
 * (ADR 0051): a run won't send it to the new URL and Enable refuses, so the panel asks for the value
 * again. Null for a value being typed, a value set before host binding, or a URL on that origin.
 */
export const getSecretBoundHostMismatch = (header: TWorkflowHttpHeader, url: string): string | null => {
  if (getHeaderRowKind(header) !== "secret_set" || !header.boundOrigin) return null;
  if (getWorkflowUrlOrigin(url) === header.boundOrigin) return null;
  return getWorkflowOriginHost(header.boundOrigin);
};

/** A new, empty header row. */
export const createHeaderRow = (): TWorkflowHttpHeader => ({ name: "", value: "" });

/**
 * A header renamed. While its lock was never set by hand and it holds no stored secret, the lock
 * follows the name: Authorization and names with token, key, secret or cookie lock by default.
 */
export const renameHeader = (
  header: TWorkflowHttpHeader,
  name: string,
  isLockChosen: boolean
): TWorkflowHttpHeader => {
  if (isLockChosen || header.isSet) return { ...header, name };
  const shouldLock = isDefaultSecretHeaderName(name);
  if (shouldLock === (header.secret === true)) return { ...header, name };
  return shouldLock ? { name, secret: true, value: header.value ?? "" } : { name, value: header.value ?? "" };
};

/**
 * The lock toggled. Locking keeps the typed value as the secret to store. A stored secret can't be
 * revealed, so unlocking one starts from an empty value.
 */
export const toggleHeaderLock = (header: TWorkflowHttpHeader): TWorkflowHttpHeader =>
  header.secret === true
    ? { name: header.name, value: header.value ?? "" }
    : { name: header.name, secret: true, value: header.value ?? "" };

/** Replace: type a new value for a stored secret. Saving it updates the stored row in place. */
export const startReplacingSecret = (header: TWorkflowHttpHeader): TWorkflowHttpHeader => ({
  name: header.name,
  secret: true,
  value: "",
  // Carried so a cancelled Replace still knows the stored value's host (ADR 0051); a write ignores it.
  ...(header.boundOrigin ? { boundOrigin: header.boundOrigin } : {}),
});

/** Cancel a Replace: keep the stored value, and the host it is sent to. */
export const cancelReplacingSecret = (header: TWorkflowHttpHeader): TWorkflowHttpHeader => ({
  name: header.name,
  secret: true,
  isSet: true,
  ...(header.boundOrigin ? { boundOrigin: header.boundOrigin } : {}),
});

/**
 * The secret headers the saved step holds a value for, by lower-cased name: typing a value for one of
 * them replaces the stored secret (ADR 0043) rather than setting a new one.
 */
export const getSavedSecretHeaderNames = (
  savedDefinition: TWorkflowDefinition | null,
  stepId: string
): Set<string> => {
  const node = savedDefinition?.nodes.find((candidate) => candidate.id === stepId);
  if (node?.type !== "action" || node.actionType !== "http_request") return new Set();
  return new Set(
    node.config.headers
      .filter((header) => header.secret === true && header.isSet)
      .map((header) => header.name.toLowerCase())
  );
};

/** Row indexes whose name another row already uses (case-insensitive); the API drops their values. */
export const findDuplicateHeaderIndexes = (headers: readonly TWorkflowHttpHeader[]): Set<number> => {
  const firstIndexByName = new Map<string, number>();
  const duplicates = new Set<number>();
  headers.forEach((header, index) => {
    const key = header.name.trim().toLowerCase();
    if (!key) return;
    const first = firstIndexByName.get(key);
    if (first === undefined) {
      firstIndexByName.set(key, index);
    } else {
      duplicates.add(first);
      duplicates.add(index);
    }
  });
  return duplicates;
};

/**
 * How Replace works on a stored secret (ADR 0043): in a draft or disabled workflow the new value is
 * written with the definition (`inline`); an enabled workflow is read-only, so Replace saves the one
 * value on its own (`live`) and the enabled workflow uses it from its next run. Null: no Replace (a
 * read-only member, or an archived workflow).
 */
export const getSecretReplaceMode = ({
  status,
  isEditable,
  isReadOnly,
}: {
  status: TWorkflowStatus | null;
  isEditable: boolean;
  isReadOnly: boolean;
}): "inline" | "live" | null => {
  if (isReadOnly) return null;
  if (isEditable) return "inline";
  return status === "enabled" ? "live" : null;
};

/**
 * Replacing a secret changes the row an enabled version also reads (ADR 0043), so a workflow that has
 * been enabled warns before saving. Only a disabled one can be edited; an enabled one is read-only.
 */
export const shouldWarnSecretGoesLive = (status: TWorkflowStatus | null): boolean =>
  status === "disabled" || status === "enabled";

/**
 * What "Send test request" sends: the step's draft settings, and the test payload kept in this
 * browser when it is a JSON object (else the server uses the Sample payload). A secret without a
 * typed value uses the saved secret of that name.
 */
export const buildTestRequestInput = (
  config: TWorkflowHttpRequestActionConfig,
  storedTestPayload: string | null
): TSendWorkflowTestRequestInput => {
  let payload: Record<string, unknown> | undefined;
  if (storedTestPayload) {
    try {
      const parsed: unknown = JSON.parse(storedTestPayload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      // An unfinished edit: fall back to the Sample payload.
    }
  }
  return { config, ...(payload ? { variables: { payload } } : {}) };
};

/**
 * The definition as the server will hold it, for the editor's live readiness check. The API reads a
 * stored secret back as `{secret: true, isSet: true}` with no `secretId`, and a typed value gets one
 * on save; the executable schema only knows the stored shape and would flag every secret header as
 * missing. A secret with neither a stored nor a typed value stays without one, so it is still flagged,
 * and so does a stored one set for another host than the step's URL, which Enable refuses (ADR 0051).
 */
export const withSecretIdsForCheck = (definition: TWorkflowDefinition): TWorkflowDefinition => {
  let changed = false;
  const nodes = definition.nodes.map((node) => {
    if (node.type !== "action" || node.actionType !== "http_request") return node;
    let nodeChanged = false;
    const headers = node.config.headers.map((header) => {
      const hasValue =
        (header.isSet === true && getSecretBoundHostMismatch(header, node.config.url) === null) ||
        (header.value !== undefined && header.value !== "");
      if (header.secret !== true || header.secretId || !hasValue) return header;
      nodeChanged = true;
      return { ...header, secretId: "pending" };
    });
    if (!nodeChanged) return node;
    changed = true;
    return { ...node, config: { ...node.config, headers } };
  });
  return changed ? { ...definition, nodes } : definition;
};

/**
 * After a save, the secret values it sent are stored: swap them in the draft for the stored shape
 * (`{name, secret: true, isSet: true, boundOrigin}`, bound to the URL the save sent, ADR 0051), so the
 * next autosave keeps the secret instead of sending its value again (which would record another
 * "replaced"). Only headers whose value is still the one sent are swapped; one edited since keeps its
 * new value for the next save.
 */
export const settleSentSecretValues = (
  draft: TWorkflowDefinition,
  sent: TWorkflowDefinition
): TWorkflowDefinition => {
  const sentValues = new Map<string, { value: string; boundOrigin: string | null }>();
  for (const node of sent.nodes) {
    if (node.type !== "action" || node.actionType !== "http_request") continue;
    const boundOrigin = getWorkflowUrlOrigin(node.config.url);
    for (const header of node.config.headers) {
      if (header.secret === true && header.value) {
        sentValues.set(`${node.id}\u0000${header.name.toLowerCase()}`, { value: header.value, boundOrigin });
      }
    }
  }
  if (sentValues.size === 0) return draft;

  let changed = false;
  const nodes = draft.nodes.map((node) => {
    if (node.type !== "action" || node.actionType !== "http_request") return node;
    let nodeChanged = false;
    const headers = node.config.headers.map((header) => {
      const sent = sentValues.get(`${node.id}\u0000${header.name.toLowerCase()}`);
      if (header.secret !== true || sent === undefined || header.value !== sent.value) return header;
      nodeChanged = true;
      return {
        name: header.name,
        secret: true,
        isSet: true,
        ...(sent.boundOrigin ? { boundOrigin: sent.boundOrigin } : {}),
      };
    });
    if (!nodeChanged) return node;
    changed = true;
    return { ...node, config: { ...node.config, headers } };
  });
  return changed ? { ...draft, nodes } : draft;
};

/**
 * After a save, a secret header the draft shows as set but that the save stored no value for (Undo
 * brought back a header whose step was deleted and saved, so its stored secret is gone) takes the
 * saved shape: not set. Without this the panel says "set" while the server has nothing to send.
 */
export const settleUnstoredSecrets = (
  draft: TWorkflowDefinition,
  saved: TWorkflowDefinition
): TWorkflowDefinition => {
  const storedHeaders = new Set<string>();
  for (const node of saved.nodes) {
    if (node.type !== "action" || node.actionType !== "http_request") continue;
    for (const header of node.config.headers) {
      if (header.secret === true && header.isSet === true) {
        storedHeaders.add(`${node.id}\u0000${header.name.toLowerCase()}`);
      }
    }
  }

  let changed = false;
  const nodes = draft.nodes.map((node) => {
    if (node.type !== "action" || node.actionType !== "http_request") return node;
    let nodeChanged = false;
    const headers = node.config.headers.map((header) => {
      const claimsStored = header.secret === true && header.isSet === true && !header.value;
      if (!claimsStored || storedHeaders.has(`${node.id}\u0000${header.name.toLowerCase()}`)) return header;
      nodeChanged = true;
      return { name: header.name, secret: true as const, isSet: false };
    });
    if (!nodeChanged) return node;
    changed = true;
    return { ...node, config: { ...node.config, headers } };
  });
  return changed ? { ...draft, nodes } : draft;
};
