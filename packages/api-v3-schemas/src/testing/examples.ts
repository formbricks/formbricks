import { z } from "zod";
import { type JsonObject, type JsonValue, isJsonObject, schemaNameFromRef } from "./json";

/** One media-type example from the contract, with the schema it is published against. */
export type TContractExample = { label: string; schema: JsonValue; value: JsonValue };

const HTTP_METHODS = ["get", "put", "post", "patch", "delete"] as const;

const mediaExamples = (label: string, content: JsonValue): TContractExample[] => {
  if (!isJsonObject(content)) return [];
  return Object.entries(content).flatMap(([mediaType, media]) => {
    if (!isJsonObject(media) || !("schema" in media)) return [];
    const named = isJsonObject(media.examples)
      ? Object.entries(media.examples).flatMap(([name, example]) =>
          isJsonObject(example) && "value" in example
            ? [
                {
                  label: `${label} ${mediaType} examples.${name}`,
                  schema: media.schema,
                  value: example.value,
                },
              ]
            : []
        )
      : [];
    const single =
      "example" in media
        ? [{ label: `${label} ${mediaType} example`, schema: media.schema, value: media.example }]
        : [];
    return [...named, ...single];
  });
};

/** Every request-body and response media-type example under the given operations. */
export const collectOperationExamples = (
  document: JsonObject,
  operationIds: ReadonlySet<string>
): TContractExample[] => {
  const paths = isJsonObject(document.paths) ? document.paths : {};
  return Object.values(paths).flatMap((item) =>
    isJsonObject(item)
      ? HTTP_METHODS.flatMap((method) => {
          const operation = item[method];
          if (!isJsonObject(operation) || typeof operation.operationId !== "string") return [];
          if (!operationIds.has(operation.operationId)) return [];
          const id = operation.operationId;
          const request = isJsonObject(operation.requestBody)
            ? mediaExamples(`${id} request`, operation.requestBody.content)
            : [];
          const responses = isJsonObject(operation.responses)
            ? Object.entries(operation.responses).flatMap(([status, response]) =>
                isJsonObject(response) ? mediaExamples(`${id} ${status}`, response.content) : []
              )
            : [];
          return [...request, ...responses];
        })
      : []
  );
};

/**
 * Build a validator for a media type's schema from named Zod schemas.
 *
 * Only the shapes the v3 contract wraps components in are supported — a `$ref`, an inline object
 * envelope (`{ data, meta }`), an array of either — so an example is always checked against the real
 * schema of its payload. Anything else throws, which fails the test rather than skipping the example.
 */
export const validatorFor = (schema: JsonValue, components: ReadonlyMap<string, z.ZodType>): z.ZodType => {
  if (!isJsonObject(schema)) throw new Error(`Unsupported example schema ${JSON.stringify(schema)}`);
  if (typeof schema.$ref === "string") {
    const name = schemaNameFromRef(schema.$ref);
    const found = name === undefined ? undefined : components.get(name);
    if (!found) throw new Error(`No Zod schema for ${schema.$ref}`);
    return found;
  }
  if (schema.type === "array") return z.array(validatorFor(schema.items ?? null, components));
  if (schema.type === "object" && isJsonObject(schema.properties)) {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const shape = Object.fromEntries(
      Object.entries(schema.properties).map(([name, property]) => {
        const inner = validatorFor(property, components);
        return [name, required.has(name) ? inner : inner.optional()];
      })
    );
    return schema.additionalProperties === false ? z.strictObject(shape) : z.object(shape);
  }
  throw new Error(`Unsupported example schema ${JSON.stringify(schema).slice(0, 120)}`);
};
