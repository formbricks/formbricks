/**
 * Contract-test helpers shared by this package's guards and by the consumers that wrap the generated
 * schemas. Test-only: nothing served imports this entry point, and it reads the bundle from disk.
 */
export { BUNDLE_PATH, parseOpenApiDocument, readBundle } from "./bundle";
export { type TContractExample, collectOperationExamples, validatorFor } from "./examples";
export { type TFactDiff, type TFacts, collectFacts, diffFacts, pointerResolver } from "./facts";
export { type JsonObject, type JsonValue, isJsonObject, resolvePointer } from "./json";
export { EXPECTED_UNENFORCED, type TUnenforced, type TUnenforcedKeyword, unenforcedKey } from "./unenforced";
export {
  diffAgainstSpec,
  findOperation,
  parametersAsObjectSchema,
  requestBodySchema,
  toJsonSchema,
} from "./fidelity";
