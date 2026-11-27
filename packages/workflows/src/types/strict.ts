import { z } from "zod";

/**
 * A copy of `schema` in which every object that would silently drop an unknown key rejects it instead.
 *
 * Derived from the lenient schema rather than written next to it, so the two cannot drift: a field
 * added to the lenient tree is in the strict one too. Objects that keep unknown keys on purpose
 * (`.catchall(z.unknown())`, such as a step's builder `ui` metadata) stay open, and refinements,
 * defaults and descriptions carry over unchanged.
 */
export const toStrictSchema = <TSchema extends z.ZodType>(schema: TSchema): TSchema =>
  convert(schema, new Map()) as TSchema;

type TAnySchema = z.core.$ZodType;
type TDef = z.core.$ZodTypeDef & Record<string, unknown>;

/** Builds a schema of the same class from a changed def, keeping the original's description and meta. */
const rebuild = (schema: TAnySchema, changes: Record<string, unknown>): TAnySchema => {
  const copy = new schema._zod.constr({ ...(schema._zod.def as TDef), ...changes });
  const meta = z.globalRegistry.get(schema);
  if (meta) z.globalRegistry.add(copy, meta);
  return copy;
};

const convert = (schema: TAnySchema, seen: Map<TAnySchema, TAnySchema>): TAnySchema => {
  const done = seen.get(schema);
  if (done) return done;

  const def = schema._zod.def as TDef;
  const inner = (child: unknown): TAnySchema => convert(child as TAnySchema, seen);

  switch (def.type) {
    case "lazy": {
      // Recursive schemas (the If/else condition group) are lazy; registering the copy before its
      // getter runs is what lets the recursion find it instead of converting forever.
      const getter = def.getter as () => TAnySchema;
      const copy = z.lazy(() => inner(getter()) as z.ZodType);
      seen.set(schema, copy);
      return copy;
    }
    case "object": {
      const shape = Object.fromEntries(
        Object.entries(def.shape as Record<string, unknown>).map(([key, value]) => [key, inner(value)])
      );
      // No catchall means "strip": that is the case that drops a misspelled key, so it becomes "never".
      const catchall = def.catchall === undefined ? z.never() : inner(def.catchall);
      return remember(schema, rebuild(schema, { shape, catchall }), seen);
    }
    case "array":
      return remember(schema, rebuild(schema, { element: inner(def.element) }), seen);
    case "union":
      return remember(schema, rebuild(schema, { options: (def.options as unknown[]).map(inner) }), seen);
    case "intersection":
      return remember(schema, rebuild(schema, { left: inner(def.left), right: inner(def.right) }), seen);
    case "record":
      return remember(schema, rebuild(schema, { valueType: inner(def.valueType) }), seen);
    case "tuple":
      return remember(
        schema,
        rebuild(schema, {
          items: (def.items as unknown[]).map(inner),
          rest: def.rest ? inner(def.rest) : def.rest,
        }),
        seen
      );
    case "pipe":
      return remember(schema, rebuild(schema, { in: inner(def.in), out: inner(def.out) }), seen);
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "nonoptional":
    case "readonly":
    case "catch":
    case "success":
      return remember(schema, rebuild(schema, { innerType: inner(def.innerType) }), seen);
    default:
      // Leaves (strings, numbers, enums, literals, unknown, custom checks) hold no object.
      return schema;
  }
};

const remember = (schema: TAnySchema, copy: TAnySchema, seen: Map<TAnySchema, TAnySchema>): TAnySchema => {
  seen.set(schema, copy);
  return copy;
};
