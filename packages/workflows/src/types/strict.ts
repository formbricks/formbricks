import { z } from "zod";

/**
 * A copy of `schema` in which every object that would silently drop an unknown key rejects it instead.
 *
 * Derived from the lenient schema rather than written next to it, so the two cannot drift: a field
 * added to the lenient tree is in the strict one too. Objects that keep unknown keys on purpose
 * (`.catchall(z.unknown())`, such as a step's builder `ui` metadata) stay open, and refinements,
 * defaults and descriptions carry over unchanged.
 *
 * It knows the schema kinds the workflow definition is built from. Any other kind that can hold an
 * object throws when the module loads, so a new one is taught here rather than left lenient unnoticed.
 */
export const toStrictSchema = <TSchema extends z.ZodType>(schema: TSchema): TSchema =>
  convert(schema, new Map()) as TSchema;

type TAnySchema = z.core.$ZodType;
type TDef = z.core.$ZodTypeDef & Record<string, unknown>;

/** Kinds that hold no schema of their own, so no object can hide in them. */
const LEAF_TYPES = new Set(["string", "number", "boolean", "null", "literal", "enum", "unknown", "never"]);

/** Kinds that wrap one schema in `innerType`. */
const WRAPPER_TYPES = new Set(["optional", "nullable", "default"]);

const convert = (schema: TAnySchema, seen: Map<TAnySchema, TAnySchema>): TAnySchema => {
  const done = seen.get(schema);
  if (done) return done;

  const def = schema._zod.def as TDef;
  const inner = (child: unknown): TAnySchema => convert(child as TAnySchema, seen);

  /** A schema of the same class from a changed def, keeping the original's description and meta. */
  const rebuild = (changes: Record<string, unknown>): TAnySchema => {
    const copy = new schema._zod.constr({ ...def, ...changes });
    const meta = z.globalRegistry.get(schema);
    if (meta) z.globalRegistry.add(copy, meta);
    seen.set(schema, copy);
    return copy;
  };

  if (LEAF_TYPES.has(def.type)) return schema;
  if (WRAPPER_TYPES.has(def.type)) return rebuild({ innerType: inner(def.innerType) });

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
      return rebuild({ shape, catchall });
    }
    case "array":
      return rebuild({ element: inner(def.element) });
    case "union":
      return rebuild({ options: (def.options as unknown[]).map(inner) });
    default:
      throw new Error(`toStrictSchema does not handle Zod "${def.type}" schemas yet`);
  }
};
