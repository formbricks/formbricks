import { z } from "zod";

/**
 * Container types `strictDeep` cannot rebuild. A schema holding one is refused when the route module loads,
 * rather than left silently stripping unknown keys somewhere inside.
 */
const UNSUPPORTED_CONTAINERS = new Set([
  "record",
  "tuple",
  "intersection",
  "lazy",
  "pipe",
  "map",
  "set",
  "catch",
  "prefault",
  "readonly",
  "promise",
]);

const rebuild = (schema: z.ZodType): z.ZodType => {
  const def = schema._zod.def;
  switch (def.type) {
    case "object": {
      const object = schema as z.ZodObject;
      const shape: Record<string, z.ZodType> = {};
      for (const [key, value] of Object.entries(object.shape)) shape[key] = rebuild(value as z.ZodType);
      // `safeExtend` keeps the object's own refinements; `strict` keeps them too.
      return object.safeExtend(shape).strict();
    }
    case "optional": {
      const inner = (schema as z.ZodOptional).unwrap() as z.ZodType;
      const rebuilt = rebuild(inner);
      return rebuilt === inner ? schema : rebuilt.optional();
    }
    case "nullable": {
      const inner = (schema as z.ZodNullable).unwrap() as z.ZodType;
      const rebuilt = rebuild(inner);
      return rebuilt === inner ? schema : rebuilt.nullable();
    }
    case "array": {
      const array = schema as z.ZodArray;
      const element = array.element as z.ZodType;
      const rebuilt = rebuild(element);
      // `clone` keeps the array's own checks (min, max).
      return rebuilt === element ? schema : array.clone({ ...array._zod.def, element: rebuilt });
    }
    case "union": {
      const union = schema as z.ZodUnion<readonly z.ZodType[]>;
      const options = union.options.map(rebuild);
      if (options.every((option, index) => option === union.options[index])) return schema;
      return union.clone({ ...union._zod.def, options });
    }
    case "default": {
      const inner = (schema as z.ZodDefault).unwrap() as z.ZodType;
      const rebuilt = rebuild(inner);
      return rebuilt === inner ? schema : rebuilt.default((schema as z.ZodDefault)._zod.def.defaultValue);
    }
    default:
      // Any other wrapper around an inner schema is refused too, so nothing nested escapes unseen.
      if (UNSUPPORTED_CONTAINERS.has(def.type) || "innerType" in def) {
        throw new Error(`strictDeep cannot make a "${def.type}" schema strict`);
      }
      return schema;
  }
};

/**
 * A copy of `schema` that rejects unknown keys at every nesting level, keeping every other rule.
 *
 * Request bodies answer 400 for an unknown key at any depth (CODING_STANDARDS.md "API Design"), while the
 * shared schemas in `@formbricks/types` strip them, and other callers rely on that. Routes take a strict
 * copy instead of changing the shared schema.
 */
export const strictDeep = <T extends z.ZodType>(schema: T): T => rebuild(schema) as T;
