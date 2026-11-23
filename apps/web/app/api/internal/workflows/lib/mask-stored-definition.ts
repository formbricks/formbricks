import { type TWorkflowDefinition, maskWorkflowSecretHeaders } from "@formbricks/workflows";

/**
 * A stored definition (a version's, or the draft a Test run saved) as readers get it: secret headers as
 * `{name, secret, isSet}`, never a secretId. Anything that isn't a definition passes through.
 */
export const maskStoredDefinition = (definition: unknown): unknown =>
  typeof definition === "object" &&
  definition !== null &&
  Array.isArray((definition as { nodes?: unknown }).nodes)
    ? maskWorkflowSecretHeaders(definition as TWorkflowDefinition)
    : definition;
