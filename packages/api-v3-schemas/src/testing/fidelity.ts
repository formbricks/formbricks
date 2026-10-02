import { z } from "zod";
import { type TFactDiff, collectFacts, diffFacts, pointerResolver } from "./facts";
import { type JsonObject, type JsonValue, cloneJson, isJsonObject, resolvePointer } from "./json";

/**
 * JSON Schema of what a Zod schema accepts, in the form the differ compares.
 *
 * `io: "input"` is load-bearing: in output mode Zod also reports a stripping `z.object` as closed, which
 * would hide exactly the strict-vs-strip difference these guards exist for.
 */
export const toJsonSchema = (schema: z.ZodType): JsonObject => {
  const json = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    reused: "inline",
    cycles: "ref",
  });
  const plain = cloneJson(json as JsonValue);
  if (!isJsonObject(plain)) throw new Error("z.toJSONSchema did not return an object");
  return plain;
};

/** Facts of the contract schema at `specNode` versus facts of what `schema` enforces. */
export const diffAgainstSpec = (
  document: JsonObject,
  specNode: JsonValue,
  schema: z.ZodType
): TFactDiff[] => {
  const json = toJsonSchema(schema);
  return diffFacts(
    collectFacts(specNode, { resolve: pointerResolver(document), zodSide: false }),
    collectFacts(json, { resolve: pointerResolver(json), zodSide: true })
  );
};

const HTTP_METHODS = ["get", "put", "post", "patch", "delete"] as const;

export const findOperation = (
  document: JsonObject,
  operationId: string
): { operation: JsonObject; pathItem: JsonObject } => {
  for (const item of Object.values(isJsonObject(document.paths) ? document.paths : {})) {
    if (!isJsonObject(item)) continue;
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (isJsonObject(operation) && operation.operationId === operationId)
        return { operation, pathItem: item };
    }
  }
  throw new Error(`No operation ${operationId}`);
};

/**
 * An operation's `in: query` or `in: path` parameters as one object schema — the shape the generated
 * `z<Operation>Query` / `z<Operation>Path` validate. `undefined` when the operation has none.
 */
export const parametersAsObjectSchema = (
  document: JsonObject,
  operationId: string,
  location: "query" | "path"
): JsonObject | undefined => {
  const { operation, pathItem } = findOperation(document, operationId);
  const declared = [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ].map((parameter) =>
    isJsonObject(parameter) && typeof parameter.$ref === "string"
      ? resolvePointer(document, parameter.$ref)
      : parameter
  );
  const matching = declared.filter(
    (parameter): parameter is JsonObject => isJsonObject(parameter) && parameter.in === location
  );
  if (!matching.length) return undefined;
  const properties: JsonObject = {};
  const required: string[] = [];
  for (const parameter of matching) {
    if (typeof parameter.name !== "string") throw new Error(`${operationId}: parameter without a name`);
    properties[parameter.name] = parameter.schema ?? {};
    if (parameter.required === true) required.push(parameter.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
};

/** The JSON request-body schema of an operation, if it declares one. */
export const requestBodySchema = (document: JsonObject, operationId: string): JsonValue | undefined => {
  const { operation } = findOperation(document, operationId);
  const body = isJsonObject(operation.requestBody) ? operation.requestBody : undefined;
  const media = body && isJsonObject(body.content) ? body.content["application/json"] : undefined;
  return isJsonObject(media) ? media.schema : undefined;
};
