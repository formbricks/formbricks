import { type JsonObject, type JsonValue, isJsonObject, resolvePointer } from "./json";

/**
 * Structural "facts" about a JSON Schema, path by path, for comparing what the contract says with what a
 * Zod schema enforces.
 *
 * The same extractor runs on a spec schema and on `z.toJSONSchema()` of a Zod schema, so the two sides
 * are flattened by one algorithm. It resolves `$ref`, merges `allOf` itself (independently of the
 * generator's normalizer, so a bug there cannot hide here), folds `[X, null]` unions and type arrays into
 * nullability, and keys union members by their discriminating enum values. Each path records type,
 * nullability, required/props/closedness for objects, enum/const, formats and bounds.
 */

export type TFactRow = Record<string, string | number | boolean>;
export type TFacts = Map<string, TFactRow>;
export type TFactDiff = { path: string; attr: string; spec: unknown; zod: unknown };

type TResolver = (ref: string) => JsonValue | undefined;
type TSub = { node: JsonValue; seen: ReadonlySet<string> };

const SCALAR_KEYWORDS = [
  "format",
  "pattern",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
] as const;

const ANNOTATION_SIBLINGS = new Set([
  "description",
  "title",
  "readOnly",
  "writeOnly",
  "example",
  "examples",
  "deprecated",
]);

/** `z.int()` publishes the safe-integer range; the contract never states it. */
const SAFE_INTEGER_BOUND = Number.MAX_SAFE_INTEGER;

interface IFlat {
  types: Set<string>;
  nullable: boolean;
  props: Map<string, TSub>;
  required: Set<string>;
  closed: boolean;
  additional?: TSub;
  items?: TSub;
  union?: TSub[];
  enumValues?: JsonValue[];
  constValue?: JsonValue;
  hasConst: boolean;
  scalars: Map<string, JsonValue>;
  defaultValue?: JsonValue;
  hasDefault: boolean;
  conditional: boolean;
  negated: boolean;
  cycle?: string;
}

const emptyFlat = (): IFlat => ({
  types: new Set(),
  nullable: false,
  props: new Map(),
  required: new Set(),
  closed: false,
  hasConst: false,
  scalars: new Map(),
  hasDefault: false,
  conditional: false,
  negated: false,
});

const isNullSchema = (node: JsonValue): boolean =>
  isJsonObject(node) &&
  (node.type === "null" ||
    node.const === null ||
    (Array.isArray(node.enum) && node.enum.length === 1 && node.enum[0] === null));

const combine = (a: TSub | undefined, b: TSub): TSub =>
  a ? { node: { allOf: [a.node, b.node] }, seen: new Set([...a.seen, ...b.seen]) } : b;

const deref = (resolve: TResolver, sub: TSub): TSub => {
  let node = sub.node;
  let seen = sub.seen;
  for (let hops = 0; hops < 64 && isJsonObject(node) && typeof node.$ref === "string"; hops++) {
    const ref = node.$ref;
    if (seen.has(ref)) return { node: { "x-cycle": ref }, seen };
    seen = new Set([...seen, ref]);
    const target = resolve(ref);
    if (target === undefined) throw new Error(`facts: unresolvable ${ref}`);
    const { $ref: _ref, ...siblings } = node;
    const constraining = Object.keys(siblings).some((key) => !ANNOTATION_SIBLINGS.has(key));
    node = constraining ? { ...siblings, allOf: [target] } : target;
  }
  return { node, seen };
};

const addType = (flat: IFlat, type: JsonValue): void => {
  if (type === "null") flat.nullable = true;
  else if (typeof type === "string") flat.types.add(type);
};

const mergeUnion = (
  resolve: TResolver,
  flat: IFlat,
  members: JsonValue[],
  seen: ReadonlySet<string>,
  depth: number
): void => {
  const resolved = members.map((member) => deref(resolve, { node: member, seen }));
  const nonNull = resolved.filter((member) => !isNullSchema(member.node));
  if (nonNull.length !== resolved.length) flat.nullable = true;
  const literals = nonNull.map((member) => {
    const node = member.node;
    if (!isJsonObject(node) || "properties" in node) return undefined;
    if ("const" in node) return { value: node.const };
    if (Array.isArray(node.enum) && node.enum.length === 1) return { value: node.enum[0] };
    return undefined;
  });
  if (nonNull.length > 1 && literals.every((literal) => literal !== undefined)) {
    flat.enumValues = literals.map((literal) => literal.value);
    return;
  }
  if (nonNull.length === 1) {
    mergeInto(resolve, flat, nonNull[0], depth + 1);
    return;
  }
  if (nonNull.length > 1) flat.union = nonNull;
};

function mergeInto(resolve: TResolver, flat: IFlat, sub: TSub, depth: number): void {
  const { node, seen } = deref(resolve, sub);
  if (node === true) return;
  if (node === false) {
    flat.negated = true;
    return;
  }
  if (!isJsonObject(node)) return;
  if (typeof node["x-cycle"] === "string") {
    flat.cycle = node["x-cycle"].split("/").pop();
    return;
  }
  if (depth > 64) throw new Error("facts: schema nesting deeper than 64");

  if (Array.isArray(node.type)) node.type.forEach((type) => addType(flat, type));
  else if ("type" in node) addType(flat, node.type);

  if (Array.isArray(node.enum)) {
    const values = node.enum.filter((value) => value !== null);
    if (values.length !== node.enum.length) flat.nullable = true;
    if (values.length === 1) {
      flat.constValue = values[0];
      flat.hasConst = true;
    } else flat.enumValues = values;
  }
  if ("const" in node) {
    if (node.const === null) flat.nullable = true;
    else {
      flat.constValue = node.const;
      flat.hasConst = true;
    }
  }
  for (const keyword of SCALAR_KEYWORDS) if (keyword in node) flat.scalars.set(keyword, node[keyword]);
  if ("default" in node) {
    flat.defaultValue = node.default;
    flat.hasDefault = true;
  }
  if ("if" in node || "then" in node || "else" in node) flat.conditional = true;
  if ("not" in node) flat.negated = true;

  if (isJsonObject(node.properties)) {
    for (const [name, property] of Object.entries(node.properties)) {
      flat.props.set(name, combine(flat.props.get(name), { node: property, seen }));
    }
  }
  if (Array.isArray(node.required))
    for (const name of node.required) if (typeof name === "string") flat.required.add(name);
  if (node.additionalProperties === false || node.unevaluatedProperties === false) flat.closed = true;
  else if (isJsonObject(node.additionalProperties) && Object.keys(node.additionalProperties).length > 0) {
    flat.additional = combine(flat.additional, { node: node.additionalProperties, seen });
  }
  if (isJsonObject(node.items)) flat.items = { node: node.items, seen };

  if (Array.isArray(node.allOf)) {
    for (const member of node.allOf) mergeInto(resolve, flat, { node: member, seen }, depth + 1);
  }
  const union = Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : undefined;
  if (union) mergeUnion(resolve, flat, union, seen, depth);
}

const ANY_JSON_TYPES = ["object", "array", "string", "boolean"];

const flatten = (resolve: TResolver, sub: TSub): IFlat => {
  const flat = emptyFlat();
  mergeInto(resolve, flat, sub, 0);
  if (flat.types.size === 0 && (flat.props.size || flat.additional)) flat.types.add("object");
  if (flat.types.size === 0 && flat.items) flat.types.add("array");
  if (flat.types.has("integer") && flat.types.has("number")) flat.types.delete("integer");
  if (ANY_JSON_TYPES.every((type) => flat.types.has(type))) {
    flat.types.clear();
    flat.props.clear();
    flat.items = undefined;
  }
  if ((flat.hasConst || flat.enumValues) && flat.types.has("integer")) {
    flat.types.delete("integer");
    flat.types.add("number");
  }
  if (flat.hasConst) flat.enumValues = undefined;
  return flat;
};

const stringify = (value: JsonValue): string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : JSON.stringify(value);

/** A key per union member: `prop=value` for every discriminating value, else its position and type. */
const memberKeys = (resolve: TResolver, members: TSub[]): string[][] => {
  const flats = members.map((member) => flatten(resolve, member));
  const shared = [...(flats[0]?.props.keys() ?? [])].filter((name) =>
    flats.every((flat) => flat.props.has(name))
  );
  for (const name of shared) {
    const values = flats.map((flat) => {
      const property = flat.props.get(name);
      if (!property) return undefined;
      const resolved = flatten(resolve, property);
      if (resolved.hasConst && resolved.constValue !== undefined) return [resolved.constValue];
      return resolved.enumValues;
    });
    if (values.every((list) => list?.length)) {
      return values.map((list) => (list ?? []).map((value) => `${name}=${String(stringify(value))}`));
    }
  }
  return flats.map((flat, index) => [
    `#${index}:${flat.cycle ? "recursive" : [...flat.types].sort().join("|") || "any"}`,
  ]);
};

export type TCollectOptions = {
  resolve: TResolver;
  /** The Zod side emits a `pattern` for every built-in format; the contract states the format only. */
  zodSide: boolean;
};

export const collectFacts = (root: JsonValue, options: TCollectOptions): TFacts => {
  const facts: TFacts = new Map();
  const pins = new Map<string, { prop: string; value: string }>();

  const visit = (sub: TSub, path: string, pin?: { prop: string; value: string }): void => {
    const flat = flatten(options.resolve, sub);
    if (pin) {
      // Inside the member keyed `prop=value`, the discriminator is that one value on both sides.
      flat.hasConst = true;
      flat.constValue = pin.value;
      flat.enumValues = undefined;
    }
    const row: TFactRow = {};
    const numeric = flat.types.has("number") || flat.types.has("integer");
    row.type = [...flat.types].sort().join("|") || "any";
    row.nullable = flat.nullable;
    if (flat.cycle) row.cycle = flat.cycle;
    if (flat.hasConst && flat.constValue !== undefined) row.const = JSON.stringify(flat.constValue);
    if (flat.enumValues)
      row.enum = JSON.stringify(flat.enumValues.map((value) => String(stringify(value))).sort());
    for (const [keyword, value] of flat.scalars) {
      // Zod publishes its own regex for every built-in format; the contract states the format alone.
      // Only the Zod side drops it, so a contract `pattern` stated beside a format is still compared.
      if (options.zodSide && keyword === "pattern" && flat.scalars.has("format")) continue;
      if ((keyword === "minimum" || keyword === "maximum") && Math.abs(Number(value)) >= SAFE_INTEGER_BOUND)
        continue;
      if (keyword === "format" && numeric) continue; // int32/double are descriptive in this contract
      row[keyword] = stringify(value);
    }
    if (flat.hasDefault && flat.defaultValue !== undefined) row.default = JSON.stringify(flat.defaultValue);
    if (flat.conditional) row.conditional = true;
    if (flat.negated) row.not = true;
    if (flat.types.has("object") || flat.props.size > 0) {
      row.closed = flat.closed;
      row.props = [...flat.props.keys()].sort().join(",");
      row.required = [...flat.required]
        .filter((name) => flat.props.has(name) || !flat.additional)
        .sort()
        .join(",");
    }
    let keys: string[][] | undefined;
    if (flat.union) {
      keys = memberKeys(options.resolve, flat.union);
      row.union = [...new Set(keys.flat())].sort().join(" ; ");
    }
    facts.set(path, row);
    if (flat.cycle) return;

    const pinned = pins.get(path);
    for (const [name, property] of flat.props) {
      visit(property, `${path}.${name}`, pinned?.prop === name ? pinned : undefined);
    }
    if (flat.items) visit(flat.items, `${path}[]`);
    if (flat.additional) visit(flat.additional, `${path}{}`);
    if (flat.union && keys) {
      const memberKeyLists = keys;
      flat.union.forEach((member, index) => {
        for (const key of memberKeyLists[index]) {
          const match = /^([^=#]+)=(.*)$/.exec(key);
          const memberPath = `${path}|${key}`;
          if (match) pins.set(memberPath, { prop: match[1], value: match[2] });
          visit(member, memberPath);
        }
      });
    }
  };

  visit({ node: root, seen: new Set() }, "$");
  return facts;
};

const parentOf = (path: string): string => path.replace(/(\.[^.[{|]+|\[\]|\{\}|\|[^|]+)$/, "");
const isUnder = (path: string, prefix: string): boolean =>
  [".", "[", "{", "|"].some((separator) => path.startsWith(prefix + separator));

/** Diff two fact maps. A path present on one side only is reported once; its descendants are not. */
export const diffFacts = (spec: TFacts, zod: TFacts): TFactDiff[] => {
  const out: TFactDiff[] = [];
  const missing: string[] = [];
  for (const path of [...new Set([...spec.keys(), ...zod.keys()])].sort()) {
    if (missing.some((prefix) => isUnder(path, prefix))) continue;
    const a = spec.get(path);
    const b = zod.get(path);
    if (!a || !b) {
      // A recursion cut-off on one side is a traversal artifact, not a difference.
      const parent = parentOf(path);
      if (spec.get(parent)?.cycle || zod.get(parent)?.cycle) continue;
      out.push({ path, attr: a ? "missing-in-zod" : "missing-in-spec", spec: Boolean(a), zod: Boolean(b) });
      missing.push(path);
      continue;
    }
    if (a.cycle || b.cycle) continue;
    for (const attr of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const left = a[attr] ?? (attr === "nullable" || attr === "closed" ? false : undefined);
      const right = b[attr] ?? (attr === "nullable" || attr === "closed" ? false : undefined);
      if (left !== right) out.push({ path, attr, spec: left, zod: right });
    }
  }
  return out;
};

/** A resolver over a document's local pointers, for `collectFacts`. */
export const pointerResolver =
  (document: JsonObject): TResolver =>
  (ref) =>
    ref === "#" ? document : resolvePointer(document, ref);
