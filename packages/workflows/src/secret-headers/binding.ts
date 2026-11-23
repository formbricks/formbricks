import type { TWorkflowHttpRequestActionNode } from "../types/actions/http-request";
import type { TWorkflowChildNode, TWorkflowDefinition } from "../types/document";

/**
 * Secret header values are bound to the host they were set for (ADR 0051). Each stored value keeps
 * the origin (scheme, host and port) of its step's URL at the moment it was set or replaced, and is
 * attached only to a request to that origin: in a run, a "Don't wait" delivery, a Test run and Send
 * test request alike. A step moved to another host needs its secret values entered again, so a
 * changed URL (by a person or by an agent obeying hostile text) can never carry a stored credential
 * somewhere it was not entered for. The origin lives on the secret row, never in the definition.
 */

/** A stored secret header value and the origin it was set for (null: set before host binding). */
export interface TWorkflowStoredSecret {
  value: string;
  boundOrigin: string | null;
}

/** The origin of an absolute http(s) URL (`https://api.example.com:8443`), else null. */
export const getWorkflowUrlOrigin = (url: string): string | null => {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
};

/** An origin as people read it: the host, with the port when it is not the default. */
export const getWorkflowOriginHost = (origin: string): string => {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
};

const otherHostMessage = (headerName: string, boundOrigin: string | null): string =>
  boundOrigin
    ? `Secret header ${headerName} is set for ${getWorkflowOriginHost(boundOrigin)}; enter it again for the new URL`
    : `Secret header ${headerName} is set for another URL; enter it again for the new URL`;

/**
 * A stored secret header value for a request to `requestUrl`: the value when the request goes to the
 * origin it was set for, else why it is not sent; undefined when there is no stored value. A value
 * stored before host binding (`boundOrigin` null) is held to the origin of the step's saved URL,
 * `savedUrl`, until it is set again.
 */
export const resolveBoundWorkflowSecret = ({
  headerName,
  secret,
  requestUrl,
  savedUrl,
}: {
  headerName: string;
  secret: TWorkflowStoredSecret | undefined;
  requestUrl: string;
  savedUrl: string;
}): { value: string } | { error: string } | undefined => {
  if (!secret) return undefined;
  const allowedOrigin = secret.boundOrigin ?? getWorkflowUrlOrigin(savedUrl);
  const requestOrigin = getWorkflowUrlOrigin(requestUrl);
  if (allowedOrigin !== null && requestOrigin === allowedOrigin) return { value: secret.value };
  return { error: otherHostMessage(headerName, allowedOrigin) };
};

const isHttpRequestNode = (node: TWorkflowChildNode): node is TWorkflowHttpRequestActionNode =>
  node.type === "action" && node.actionType === "http_request";

export interface TWorkflowSecretHostMismatch {
  stepId: string;
  headerName: string;
  /** Where the header sits in the definition, for `invalid_params`. */
  path: (string | number)[];
  message: string;
}

/**
 * The stored secret headers whose value was set for another origin than their step's URL now has:
 * Enable refuses until each is entered again (ADR 0051). `boundOrigins` maps secret ids to the origin
 * each was set for; a value set before host binding (null) or a row that is not found is not listed.
 */
export const findWorkflowSecretHostMismatches = (
  definition: Pick<TWorkflowDefinition, "nodes">,
  boundOrigins: ReadonlyMap<string, string | null>
): TWorkflowSecretHostMismatch[] => {
  const mismatches: TWorkflowSecretHostMismatch[] = [];
  definition.nodes.forEach((node, nodeIndex) => {
    if (!isHttpRequestNode(node)) return;
    const stepOrigin = getWorkflowUrlOrigin(node.config.url);
    node.config.headers.forEach((header, headerIndex) => {
      if (header.secret !== true || !header.secretId) return;
      const boundOrigin = boundOrigins.get(header.secretId);
      if (!boundOrigin || boundOrigin === stepOrigin) return;
      mismatches.push({
        stepId: node.id,
        headerName: header.name,
        path: ["nodes", nodeIndex, "config", "headers", headerIndex],
        message: otherHostMessage(header.name, boundOrigin),
      });
    });
  });
  return mismatches;
};
