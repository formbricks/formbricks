/**
 * The v3 resources whose schemas are generated, keyed by OpenAPI tag, with the operations each tag
 * must contain.
 *
 * Generation is scoped to these tags so an edit elsewhere in the contract can never break this
 * pipeline, and the generated module only carries the operations and components of resources that
 * have opted in. Adopting a resource means adding its tag here — see
 * `docs/development/technical-handbook/api-v3-schema-generation.mdx`.
 *
 * The operation list is exact on purpose. Renaming the tag or an operationId in the spec would otherwise
 * shrink the scope silently, and the freshness check would happily compare one empty file to another.
 */
export const ADOPTED_OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  "V3 Responses": [
    "getResponsesV3",
    "createResponseV3",
    "countResponsesV3",
    "validateResponseV3",
    "batchDeleteResponsesV3",
    "getResponseV3",
    "updateResponseV3",
    "deleteResponseV3",
  ],
};
