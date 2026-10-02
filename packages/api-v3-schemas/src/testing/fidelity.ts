import { z } from "zod";
import { type TFactDiff, type TFacts, collectFacts, diffFacts, pointerResolver } from "./facts";
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

/** Peel optional/nullable/default/readonly wrappers off a schema. */
const unwrap = (schema: z.ZodType): z.ZodType => {
  let current: z.ZodType = schema;
  for (let depth = 0; depth < 16; depth++) {
    const inner = (current._zod.def as { innerType?: z.ZodType }).innerType;
    if (!inner) return current;
    current = inner;
  }
  return current;
};

/**
 * Required keys that are only required on paper.
 *
 * `z.toJSONSchema` lists a `z.unknown()` or `z.any()` key as required, but at runtime Zod accepts the
 * key being absent — so a required-but-untyped field (the validate envelopes' `data`) looks faithful
 * in JSON Schema and is not. This walks the Zod object tree the facts describe and asks each required
 * field directly. Union members are not entered: each is a component checked on its own.
 */
const runtimeRequiredDiffs = (specFacts: TFacts, schema: z.ZodType, path: string): TFactDiff[] => {
  const current = unwrap(schema);
  if (current instanceof z.ZodArray)
    return runtimeRequiredDiffs(specFacts, current.element as z.ZodType, `${path}[]`);
  if (current instanceof z.ZodRecord)
    return runtimeRequiredDiffs(specFacts, current.valueType as z.ZodType, `${path}{}`);
  if (!(current instanceof z.ZodObject)) return [];
  const shape = current.shape as Record<string, z.ZodType>;
  const required = String(specFacts.get(path)?.required ?? "")
    .split(",")
    .filter(Boolean);
  const looseRequired = required.filter((name) => name in shape && shape[name].safeParse(undefined).success);
  const own: TFactDiff[] = looseRequired.length
    ? [{ path, attr: "requiredAtRuntime", spec: looseRequired.join(","), zod: false }]
    : [];
  return [
    ...own,
    ...Object.entries(shape).flatMap(([name, field]) =>
      runtimeRequiredDiffs(specFacts, field, `${path}.${name}`)
    ),
  ];
};

/**
 * Facts of the contract schema at `specNode` versus facts of what `schema` enforces — structurally, from
 * Zod's own JSON Schema, plus the runtime required-key check above.
 */
export const diffAgainstSpec = (
  document: JsonObject,
  specNode: JsonValue,
  schema: z.ZodType
): TFactDiff[] => {
  const json = toJsonSchema(schema);
  const specFacts = collectFacts(specNode, { resolve: pointerResolver(document), zodSide: false });
  return [
    ...diffFacts(specFacts, collectFacts(json, { resolve: pointerResolver(json), zodSide: true })),
    ...runtimeRequiredDiffs(specFacts, schema, "$"),
  ];
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
