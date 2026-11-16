import { WorkflowInvalidInputError } from "../errors";
import type { TWorkflowSecretHeaderChange, WorkflowSecretStore } from "../handlers/context";
import {
  type TWorkflowHttpHeader,
  type TWorkflowHttpRequestActionNode,
  isDefaultSecretHeaderName,
} from "../types/actions/http-request";
import type { TWorkflowChildNode, TWorkflowDefinition } from "../types/document";
import { getWorkflowOriginHost, getWorkflowUrlOrigin } from "./binding";

/**
 * Secret headers between the API and storage (ENG-7168, ADR 0043). The definition never holds a
 * secret's value: writes swap it for the id of an encrypted `WorkflowSecret` row, reads swap the id
 * for `isSet`, and a duplicate drops the ids so its copy can't be enabled until the values are entered
 * again. A secret's identity across writes is its step and header name (case-insensitive), taken from
 * the stored definition, never from the client. A value is bound to the origin of its step's URL in
 * the definition being written (ADR 0051).
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

/** The origin a written secret value is bound to: its step's URL's. Without a valid URL, a 400. */
const boundOriginForWrite = (stepUrl: string, headerName: string): string => {
  const boundOrigin = getWorkflowUrlOrigin(stepUrl);
  if (boundOrigin === null) {
    throw new WorkflowInvalidInputError(
      `Enter the step's URL before the value of secret header ${headerName}: a secret is only sent to the host it was entered for.`
    );
  }
  return boundOrigin;
};

/**
 * Refuses a write that carries a secret value for a step without a valid URL (ADR 0051), before
 * anything is stored: such a value could not be bound to a host.
 */
export const assertWorkflowSecretHeaderValuesBindable = (definition: TWorkflowDefinition): void => {
  for (const node of definition.nodes) {
    if (!isHttpRequestNode(node)) continue;
    for (const header of node.config.headers) {
      if (isSecretOnWrite(header) && newSecretValue(header) !== null) {
        boundOriginForWrite(node.config.url, header.name);
      }
    }
  }
};

/**
 * One secret header's write: keep the stored id when no new value came in, Replace the stored row (in
 * place for the same origin, else into a new row the store returns), or create a row. The value is
 * bound to `stepUrl`'s origin; a step without a valid URL can't take one. `pending` resolves to the id
 * that holds the value.
 */
const planSecretHeaderWrite = ({
  stepId,
  stepUrl,
  headerName,
  existingId,
  value,
  store,
  workflowId,
  workspaceId,
}: {
  stepId: string;
  stepUrl: string;
  headerName: string;
  existingId: string | undefined;
  value: string | null;
  store: WorkflowSecretStore | undefined;
  workflowId: string;
  workspaceId: string;
}): {
  secretId: string | undefined;
  change?: TWorkflowSecretHeaderChange;
  pending?: Promise<string>;
} => {
  if (value === null) return { secretId: existingId };
  const boundOrigin = boundOriginForWrite(stepUrl, headerName);
  if (!store) {
    throw new Error("Secret header values can't be stored: no secret store is configured");
  }
  const host = getWorkflowOriginHost(boundOrigin);
  if (existingId) {
    return {
      secretId: existingId,
      change: { stepId, headerName, change: "replaced", host },
      pending: store
        .replace({ secretId: existingId, workflowId, workspaceId, value, boundOrigin })
        .then(({ id }) => id),
    };
  }
  return {
    secretId: undefined,
    change: { stepId, headerName, change: "set", host },
    pending: store.create({ workflowId, workspaceId, value, boundOrigin }).then(({ id }) => id),
  };
};

/**
 * Resolves a written definition's headers against the stored one: a secret with a new value is
 * stored, bound to its step's URL (replacing the stored row of the same step and name, else as a new
 * row), a secret without one keeps the stored row of that step and name (or stays unset), and any
 * client-sent `secretId`, `isSet` or `boundOrigin` is dropped. Returns the definition to persist and
 * what changed, for the audit.
 */

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
        stepUrl: node.config.url,
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
          write.pending.then((storedId) => {
            resolvedIds.set(key, storedId);
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

/**
 * What a reader sees: `{name, secret: true, isSet}` for a secret, never its value or id, plus the
 * origin its stored value is sent to (`boundOrigin`) when `boundOrigins` knows it (ADR 0051).
 */
export const maskWorkflowSecretHeaders = <D extends Pick<TWorkflowDefinition, "nodes">>(
  definition: D,
  boundOrigins: ReadonlyMap<string, string | null> = new Map()
): D =>
  mapHttpHeaders(definition, (header) => {
    if (header.secret !== true) return header;
    const boundOrigin = header.secretId ? boundOrigins.get(header.secretId) : undefined;
    return {
      name: header.name,
      secret: true,
      isSet: Boolean(header.secretId),
      ...(boundOrigin ? { boundOrigin } : {}),
    };
  });

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
 * of its stored value if it has one and the step's URL, which a value set now is bound to (ADR 0051).
 * Null when the step is not an HTTP request step or has no secret header of that name.
 */
export const findWorkflowSecretHeader = (
  definition: Pick<TWorkflowDefinition, "nodes"> | null,
  stepId: string,
  headerName: string
): { name: string; secretId: string | undefined; stepUrl: string } | null => {
  const node = definition?.nodes.find((candidate) => candidate.id === stepId);
  if (!node || !isHttpRequestNode(node)) return null;
  const wanted = headerName.toLowerCase();
  const header = node.config.headers.find(
    (candidate) => candidate.secret === true && candidate.name.toLowerCase() === wanted
  );
  return header ? { name: header.name, secretId: header.secretId, stepUrl: node.config.url } : null;
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
