import type { TWorkflowSecretHeaderChange, WorkflowSecretStore } from "../handlers/context";
import {
  type TWorkflowHttpHeader,
  type TWorkflowHttpRequestActionNode,
  isDefaultSecretHeaderName,
} from "../types/actions/http-request";
import type { TWorkflowChildNode, TWorkflowDefinition } from "../types/document";

/**
 * Secret headers between the API and storage (ENG-7168, ADR 0043). The definition never holds a
 * secret's value: writes swap it for the id of an encrypted `WorkflowSecret` row, reads swap the id
 * for `isSet`, and a duplicate drops the ids so its copy can't be enabled until the values are entered
 * again. A secret's identity across writes is its step and header name (case-insensitive), taken from
 * the stored definition, never from the client.
 */

const isHttpRequestNode = (node: TWorkflowChildNode): node is TWorkflowHttpRequestActionNode =>
  node.type === "action" && node.actionType === "http_request";

const mapHttpHeaders = <D extends Pick<TWorkflowDefinition, "nodes">>(
  definition: D,
  map: (header: TWorkflowHttpHeader, node: TWorkflowHttpRequestActionNode) => TWorkflowHttpHeader
): D => ({
  ...definition,
  nodes: definition.nodes.map((node) =>
    isHttpRequestNode(node)
      ? { ...node, config: { ...node.config, headers: node.config.headers.map((h) => map(h, node)) } }
      : node
  ),
});

/** Whether a written header is a secret: as the write says, else by its name ("locked by default"). */
const isSecretOnWrite = (header: TWorkflowHttpHeader): boolean =>
  header.secret ?? isDefaultSecretHeaderName(header.name);

/** A non-empty value the write wants stored for a secret header. */
const newSecretValue = (header: TWorkflowHttpHeader): string | null =>
  header.value !== undefined && header.value !== "" ? header.value : null;

/** The header as stored: a plain header keeps an explicit `secret: false` when its name defaults to secret. */
const toStoredPlainHeader = (header: TWorkflowHttpHeader): TWorkflowHttpHeader => ({
  name: header.name,
  value: header.value ?? "",
  ...(header.secret === false || isDefaultSecretHeaderName(header.name) ? { secret: false } : {}),
});

const toStoredSecretHeader = (name: string, secretId: string | undefined): TWorkflowHttpHeader => ({
  name,
  secret: true,
  ...(secretId ? { secretId } : {}),
});

/** Stored secret ids by step id and lowercased header name. */
const indexStoredSecretIds = (definition: TWorkflowDefinition | null): Map<string, string> => {
  const index = new Map<string, string>();
  for (const node of definition?.nodes ?? []) {
    if (!isHttpRequestNode(node)) continue;
    for (const header of node.config.headers) {
      if (header.secret === true && header.secretId) {
        index.set(`${node.id}\u0000${header.name.toLowerCase()}`, header.secretId);
      }
    }
  }
  return index;
};

/** Whether a written definition carries any secret value that has to be stored. */
export const hasWorkflowSecretHeaderValues = (definition: TWorkflowDefinition): boolean =>
  definition.nodes.some(
    (node) =>
      isHttpRequestNode(node) &&
      node.config.headers.some((header) => isSecretOnWrite(header) && newSecretValue(header) !== null)
  );

/**
 * Resolves a written definition's headers against the stored one: a secret with a new value is
 * stored (replacing the stored row of the same step and name in place, else as a new row), a secret
 * without one keeps the stored row of that step and name (or stays unset), and any client-sent
 * `secretId` / `isSet` is dropped. Returns the definition to persist and what changed, for the audit.
 */
/**
 * One secret header's write: keep the stored id when no new value came in, overwrite the stored row
 * in place on Replace, or create a row. `pending` resolves to a newly created id, if any.
 */
const planSecretHeaderWrite = ({
  stepId,
  headerName,
  existingId,
  value,
  store,
  workflowId,
  workspaceId,
}: {
  stepId: string;
  headerName: string;
  existingId: string | undefined;
  value: string | null;
  store: WorkflowSecretStore | undefined;
  workflowId: string;
  workspaceId: string;
}): {
  secretId: string | undefined;
  change?: TWorkflowSecretHeaderChange;
  pending?: Promise<string | undefined>;
} => {
  if (value === null) return { secretId: existingId };
  if (!store) {
    throw new Error("Secret header values can't be stored: no secret store is configured");
  }
  if (existingId) {
    return {
      secretId: existingId,
      change: { stepId, headerName, change: "replaced" },
      pending: store.replace({ secretId: existingId, workflowId, workspaceId, value }).then(() => undefined),
    };
  }
  return {
    secretId: undefined,
    change: { stepId, headerName, change: "set" },
    pending: store.create({ workflowId, workspaceId, value }).then(({ id }) => id),
  };
};

export const applyWorkflowSecretHeaderWrites = async ({
  definition,
  stored,
  store,
  workflowId,
  workspaceId,
}: {
  definition: TWorkflowDefinition;
  /** The workflow's stored definition, or null for a new workflow. */
  stored: TWorkflowDefinition | null;
  store: WorkflowSecretStore | undefined;
  workflowId: string;
  workspaceId: string;
}): Promise<{ definition: TWorkflowDefinition; changes: TWorkflowSecretHeaderChange[] }> => {
  const storedIds = indexStoredSecretIds(stored);
  const changes: TWorkflowSecretHeaderChange[] = [];
  const pending: Promise<void>[] = [];

  // Two passes: the writes run in parallel, then each header takes its id.
  const resolvedIds = new Map<string, string | undefined>();
  for (const node of definition.nodes) {
    if (!isHttpRequestNode(node)) continue;
    for (const header of node.config.headers) {
      if (!isSecretOnWrite(header)) continue;
      const key = `${node.id}\u0000${header.name.toLowerCase()}`;
      const write = planSecretHeaderWrite({
        stepId: node.id,
        headerName: header.name,
        existingId: storedIds.get(key),
        value: newSecretValue(header),
        store,
        workflowId,
        workspaceId,
      });
      resolvedIds.set(key, write.secretId);
      if (write.change) changes.push(write.change);
      if (write.pending) {
        pending.push(
          write.pending.then((createdId) => {
            if (createdId) resolvedIds.set(key, createdId);
          })
        );
      }
    }
  }
  await Promise.all(pending);

  const resolved = mapHttpHeaders(definition, (header, node) =>
    isSecretOnWrite(header)
      ? toStoredSecretHeader(header.name, resolvedIds.get(`${node.id}\u0000${header.name.toLowerCase()}`))
      : toStoredPlainHeader(header)
  );
  return { definition: resolved, changes };
};

/** A written definition with every secret value removed, for the first save of a new workflow. */
export const withoutWorkflowSecretHeaderValues = (definition: TWorkflowDefinition): TWorkflowDefinition =>
  mapHttpHeaders(definition, (header) =>
    isSecretOnWrite(header) ? toStoredSecretHeader(header.name, undefined) : toStoredPlainHeader(header)
  );

/** What a reader sees: `{name, secret: true, isSet}` for a secret, never its value or id. */
export const maskWorkflowSecretHeaders = <D extends Pick<TWorkflowDefinition, "nodes">>(definition: D): D =>
  mapHttpHeaders(definition, (header) =>
    header.secret === true ? { name: header.name, secret: true, isSet: Boolean(header.secretId) } : header
  );

/** A definition for a duplicate: same header names, no stored values (ADR 0043). */
export const dropWorkflowSecretIds = (definition: TWorkflowDefinition): TWorkflowDefinition =>
  mapHttpHeaders(definition, (header) =>
    header.secret === true ? toStoredSecretHeader(header.name, undefined) : header
  );

/** Every secret id a definition references. */
export const collectWorkflowSecretIds = (definition: Pick<TWorkflowDefinition, "nodes">): string[] => {
  const ids = new Set<string>();
  for (const node of definition.nodes) {
    if (!isHttpRequestNode(node)) continue;
    for (const header of node.config.headers) {
      if (header.secret === true && header.secretId) ids.add(header.secretId);
    }
  }
  return [...ids];
};

/**
 * A stored definition's secret header of an HTTP request step, by name (case-insensitive), with the id
 * of its stored value if it has one. Null when the step is not an HTTP request step or has no secret
 * header of that name.
 */
export const findWorkflowSecretHeader = (
  definition: Pick<TWorkflowDefinition, "nodes"> | null,
  stepId: string,
  headerName: string
): { name: string; secretId: string | undefined } | null => {
  const node = definition?.nodes.find((candidate) => candidate.id === stepId);
  if (!node || !isHttpRequestNode(node)) return null;
  const wanted = headerName.toLowerCase();
  const header = node.config.headers.find(
    (candidate) => candidate.secret === true && candidate.name.toLowerCase() === wanted
  );
  return header ? { name: header.name, secretId: header.secretId } : null;
};

/** The definition with one secret header (step, name case-insensitive) pointing at a stored value. */
export const setWorkflowSecretHeaderId = <D extends Pick<TWorkflowDefinition, "nodes">>(
  definition: D,
  stepId: string,
  headerName: string,
  secretId: string
): D => {
  const wanted = headerName.toLowerCase();
  return {
    ...definition,
    nodes: definition.nodes.map((node) =>
      node.id === stepId && isHttpRequestNode(node)
        ? {
            ...node,
            config: {
              ...node.config,
              headers: node.config.headers.map((header) =>
                header.secret === true && header.name.toLowerCase() === wanted
                  ? toStoredSecretHeader(header.name, secretId)
                  : header
              ),
            },
          }
        : node
    ),
  };
};
