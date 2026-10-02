import { createHash } from "node:crypto";
import { type JsonObject, type JsonValue, compareCodeUnits, isJsonObject, resolvePointer } from "./json";

/**
 * Structural "facts" about a JSON Schema, path by path, for comparing what the contract says with what a
 * Zod schema enforces.
 *
 * The same extractor runs on a spec schema and on `z.toJSONSchema()` of a Zod schema, so the two sides
 * are flattened by one algorithm. It resolves `$ref`, merges `allOf` itself rather than reusing the
 * generator's normalizer, folds `[X, null]` unions and type arrays into nullability, and keys union
 * members by their discriminating enum values. Each path records type, nullability,
 * required/props/closedness for objects, enum/const, formats, bounds and a fingerprint of any
 * conditional.
 *
 * Recursive schemas throw: comparing a recursion on one side with one on the other is not modelled, and
 * the normalizer refuses them for the same reason.
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

/** Every JSON type but null (tracked as nullability): a schema allowing all of them allows anything. */
const ALL_NON_NULL_TYPES = ["object", "array", "string", "boolean", "number"];

interface IFlat {
  types: Set<string>;
  nullable: boolean;
  props: Map<string, TSub>;
  required: Set<string>;
  closed: boolean;
  /** A closed `allOf` branch that other branches extend: under 2020-12 it rejects their properties. */
  closedBranchConflict: boolean;
  additional?: TSub;
  items?: TSub;
  union?: TSub[];
  enumValues?: JsonValue[];
  constValue?: JsonValue;
  hasConst: boolean;
  scalars: Map<string, JsonValue>;
  defaultValue?: JsonValue;
  hasDefault: boolean;
  conditionals: JsonValue[];
  negated: boolean;
}

const emptyFlat = (): IFlat => ({
  types: new Set(),
  nullable: false,
  props: new Map(),
  required: new Set(),
  closed: false,
  closedBranchConflict: false,
  hasConst: false,
  scalars: new Map(),
  hasDefault: false,
  conditionals: [],
  negated: false,
});

const isNullSchema = (node: JsonValue): boolean =>
  isJsonObject(node) &&
  (node.type === "null" ||
    node.const === null ||
    (Array.isArray(node.enum) && node.enum.length === 1 && node.enum[0] === null));

const combine = (a: TSub | undefined, b: TSub): TSub =>
  a ? { node: { allOf: [a.node, b.node] }, seen: new Set([...a.seen, ...b.seen]) } : b;

/** Key-sorted JSON, so a fingerprint does not depend on the order a spec author wrote keys in. */
function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!isJsonObject(value)) return JSON.stringify(value);
  const entries = Object.keys(value)
    .sort(compareCodeUnits)
    .map((key) => canonicalEntry(key, value[key]));
  return `{${entries.join(",")}}`;
}

function canonicalEntry(key: string, value: JsonValue): string {
  return `${JSON.stringify(key)}:${canonical(value)}`;
}

const deref = (resolve: TResolver, sub: TSub): TSub => {
  let node = sub.node;
  let seen = sub.seen;
  for (let hops = 0; hops < 64 && isJsonObject(node) && typeof node.$ref === "string"; hops++) {
    const ref = node.$ref;
    if (seen.has(ref)) throw new Error(`facts: recursive schema through ${ref} is not supported`);
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

const literalOf = (node: JsonValue): { value: JsonValue } | undefined => {
  if (!isJsonObject(node) || "properties" in node) return undefined;
  if ("const" in node) return { value: node.const };
  if (Array.isArray(node.enum) && node.enum.length === 1) return { value: node.enum[0] };
  return undefined;
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
  const literals = nonNull.map((member) => literalOf(member.node));
  if (nonNull.length > 1 && literals.every((literal) => literal !== undefined)) {
    flat.enumValues = literals.map((literal) => literal.value);
  } else if (nonNull.length === 1) {
    mergeInto(resolve, flat, nonNull[0], depth + 1);
  } else if (nonNull.length > 1) {
    flat.union = nonNull;
  }
};

const mergeEnumAndConst = (flat: IFlat, node: JsonObject): void => {
  if (Array.isArray(node.enum)) {
    const values = node.enum.filter((value) => value !== null);
    if (values.length !== node.enum.length) flat.nullable = true;
    if (values.length === 1) {
      flat.constValue = values[0];
      flat.hasConst = true;
    } else flat.enumValues = values;
  }
  if (!("const" in node)) return;
  if (node.const === null) flat.nullable = true;
  else {
    flat.constValue = node.const;
    flat.hasConst = true;
  }
};

const mergeObjectKeywords = (flat: IFlat, node: JsonObject, seen: ReadonlySet<string>): void => {
  if (isJsonObject(node.properties)) {
    for (const [name, property] of Object.entries(node.properties)) {
      flat.props.set(name, combine(flat.props.get(name), { node: property, seen }));
    }
  }
  if (Array.isArray(node.required)) {
    for (const name of node.required) if (typeof name === "string") flat.required.add(name);
  }
  if (node.additionalProperties === false || node.unevaluatedProperties === false) flat.closed = true;
  else if (isJsonObject(node.additionalProperties) && Object.keys(node.additionalProperties).length > 0) {
    flat.additional = combine(flat.additional, { node: node.additionalProperties, seen });
  }
  if (isJsonObject(node.items)) flat.items = { node: node.items, seen };
};

/**
 * `allOf` members merge into one set of facts — except that a member closing itself rejects every
 * property it does not declare, so other members extending it make the schema stricter than a merge
 * suggests. That is recorded rather than merged away.
 */
const mergeAllOf = (
  resolve: TResolver,
  flat: IFlat,
  members: JsonValue[],
  seen: ReadonlySet<string>,
  depth: number
): void => {
  const memberFlats = members.map((member) => flatten(resolve, { node: member, seen }));
  const allNames = new Set(memberFlats.flatMap((member) => [...member.props.keys()]));
  if (memberFlats.some((member) => member.closed && [...allNames].some((name) => !member.props.has(name)))) {
    flat.closedBranchConflict = true;
  }
  for (const member of members) mergeInto(resolve, flat, { node: member, seen }, depth + 1);
};

const declaredTypes = (node: JsonObject): JsonValue[] => {
  if (Array.isArray(node.type)) return node.type;
  return "type" in node ? [node.type] : [];
};

/** Type, enum/const, scalar bounds, default, conditionals and `not` — everything but structure. */
const mergeValueKeywords = (flat: IFlat, node: JsonObject): void => {
  for (const type of declaredTypes(node)) addType(flat, type);
  mergeEnumAndConst(flat, node);
  for (const keyword of SCALAR_KEYWORDS) if (keyword in node) flat.scalars.set(keyword, node[keyword]);
  if ("default" in node) {
    flat.defaultValue = node.default;
    flat.hasDefault = true;
  }
  if ("if" in node || "then" in node || "else" in node) {
    flat.conditionals.push({ if: node.if ?? null, then: node.then ?? null, else: node.else ?? null });
  }
  if ("not" in node) flat.negated = true;
};

function mergeInto(resolve: TResolver, flat: IFlat, sub: TSub, depth: number): void {
  const { node, seen } = deref(resolve, sub);
  if (node === true) return;
  if (node === false) {
    flat.negated = true;
    return;
  }
  if (!isJsonObject(node)) return;
  if (depth > 64) throw new Error("facts: schema nesting deeper than 64");

  mergeValueKeywords(flat, node);
  mergeObjectKeywords(flat, node, seen);
  if (Array.isArray(node.allOf)) mergeAllOf(resolve, flat, node.allOf, seen, depth);
  const union = node.anyOf ?? node.oneOf;
  if (Array.isArray(union)) mergeUnion(resolve, flat, union, seen, depth);
}

const valueType = (value: JsonValue): string => (typeof value === "object" ? "object" : typeof value);

const literalsOf = (flat: IFlat): JsonValue[] => {
  if (flat.hasConst && flat.constValue !== undefined) return [flat.constValue];
  return flat.enumValues ?? [];
};

/** A schema that states no `type` still has one: implied by its keywords or by its literal values. */
const inferTypes = (flat: IFlat, literals: readonly JsonValue[]): void => {
  if (flat.types.size === 0 && (flat.props.size || flat.additional)) flat.types.add("object");
  if (flat.types.size === 0 && flat.items) flat.types.add("array");
  if (flat.types.size === 0) for (const value of literals) flat.types.add(valueType(value));
};

/** Normalize type sets that mean the same thing however they were written. */
const canonicalizeTypes = (flat: IFlat, literals: readonly JsonValue[]): void => {
  if (flat.types.has("integer") && flat.types.has("number")) flat.types.delete("integer");
  if (ALL_NON_NULL_TYPES.every((type) => flat.types.has(type)) && flat.nullable) {
    flat.types.clear();
    flat.nullable = false;
    flat.props.clear();
    flat.items = undefined;
  }
  if (literals.length && flat.types.has("integer")) {
    flat.types.delete("integer");
    flat.types.add("number");
  }
};

function flatten(resolve: TResolver, sub: TSub): IFlat {
  const flat = emptyFlat();
  mergeInto(resolve, flat, sub, 0);
  const literals = literalsOf(flat);
  inferTypes(flat, literals);
  canonicalizeTypes(flat, literals);
  if (flat.hasConst) flat.enumValues = undefined;
  return flat;
}

const stringify = (value: JsonValue): string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : JSON.stringify(value);

const discriminatingValues = (resolve: TResolver, flat: IFlat, name: string): JsonValue[] | undefined => {
  const property = flat.props.get(name);
  if (!property) return undefined;
  const resolved = flatten(resolve, property);
  if (resolved.hasConst && resolved.constValue !== undefined) return [resolved.constValue];
  return resolved.enumValues;
};

/** A key per union member: `prop=value` for every discriminating value, else its position and type. */
const memberKeys = (resolve: TResolver, members: TSub[]): string[][] => {
  const flats = members.map((member) => flatten(resolve, member));
  const shared = [...(flats[0]?.props.keys() ?? [])].filter((name) =>
    flats.every((flat) => flat.props.has(name))
  );
  for (const name of shared) {
    const values = flats.map((flat) => discriminatingValues(resolve, flat, name));
    if (values.every((list) => list?.length)) {
      return values.map((list) => (list ?? []).map((value) => `${name}=${String(stringify(value))}`));
    }
  }
  return flats.map((flat, index) => [
    `#${index}:${[...flat.types].sort(compareCodeUnits).join("|") || "any"}`,
  ]);
};

export type TCollectOptions = {
  resolve: TResolver;
  /** The Zod side emits a `pattern` for every built-in format; the contract states the format only. */
  zodSide: boolean;
};

type TPin = { prop: string; value: string };

const scalarCells = (flat: IFlat, zodSide: boolean): TFactRow => {
  const row: TFactRow = {};
  const numeric = flat.types.has("number") || flat.types.has("integer");
  for (const [keyword, value] of flat.scalars) {
    // Zod publishes its own regex for every built-in format; the contract states the format alone.
    // Only the Zod side drops it, so a contract `pattern` stated beside a format is still compared.
    if (zodSide && keyword === "pattern" && flat.scalars.has("format")) continue;
    if ((keyword === "minimum" || keyword === "maximum") && Math.abs(Number(value)) >= SAFE_INTEGER_BOUND)
      continue;
    if (keyword === "format" && numeric) continue; // int32/double are descriptive in this contract
    row[keyword] = stringify(value);
  }
  return row;
};

const objectCells = (flat: IFlat): TFactRow => {
  if (!flat.types.has("object") && flat.props.size === 0) return {};
  return {
    closed: flat.closed,
    props: [...flat.props.keys()].sort(compareCodeUnits).join(","),
    required: [...flat.required]
      .filter((name) => flat.props.has(name) || !flat.additional)
      .sort(compareCodeUnits)
      .join(","),
  };
};

const rowOf = (flat: IFlat, zodSide: boolean): TFactRow => {
  const row: TFactRow = {
    type: [...flat.types].sort(compareCodeUnits).join("|") || "any",
    nullable: flat.nullable,
    ...scalarCells(flat, zodSide),
    ...objectCells(flat),
  };
  if (flat.hasConst && flat.constValue !== undefined) row.const = JSON.stringify(flat.constValue);
  if (flat.enumValues) {
    row.enum = JSON.stringify(
      flat.enumValues.map((value) => String(stringify(value))).sort(compareCodeUnits)
    );
  }
  if (flat.hasDefault && flat.defaultValue !== undefined) row.default = JSON.stringify(flat.defaultValue);
  if (flat.conditionals.length) {
    row.conditional = `sha256:${createHash("sha256").update(canonical(flat.conditionals)).digest("hex").slice(0, 16)}`;
  }
  if (flat.closedBranchConflict) row.closedBranchConflict = true;
  if (flat.negated) row.not = true;
  return row;
};

export const collectFacts = (root: JsonValue, options: TCollectOptions): TFacts => {
  const facts: TFacts = new Map();
  const pins = new Map<string, TPin>();

  const visitUnion = (path: string, members: TSub[], keys: string[][]): void => {
    members.forEach((member, index) => {
      for (const key of keys[index]) {
        // Two members answering to one key would otherwise overwrite each other's row.
        const memberPath = facts.has(`${path}|${key}`) ? `${path}|${key}~${index}` : `${path}|${key}`;
        const match = /^([^=#]+)=(.*)$/.exec(key);
        if (match) pins.set(memberPath, { prop: match[1], value: match[2] });
        visit(member, memberPath);
      }
    });
  };

  function visit(sub: TSub, path: string, pin?: TPin): void {
    const flat = flatten(options.resolve, sub);
    if (pin) {
      // Inside the member keyed `prop=value`, the discriminator is that one value on both sides.
      flat.hasConst = true;
      flat.constValue = pin.value;
      flat.enumValues = undefined;
    }
    const row = rowOf(flat, options.zodSide);
    const keys = flat.union ? memberKeys(options.resolve, flat.union) : undefined;
    if (keys) row.union = [...new Set(keys.flat())].sort(compareCodeUnits).join(" ; ");
    facts.set(path, row);

    const pinned = pins.get(path);
    for (const [name, property] of flat.props) {
      visit(property, `${path}.${name}`, pinned?.prop === name ? pinned : undefined);
    }
    if (flat.items) visit(flat.items, `${path}[]`);
    if (flat.additional) visit(flat.additional, `${path}{}`);
    if (flat.union && keys) visitUnion(path, flat.union, keys);
  }

  visit({ node: root, seen: new Set() }, "$");
  return facts;
};

/**
 * The fact paths `collectFacts` gives the members of a union of inline schemas, in member order — `null`
 * for a member it folds into nullability, and the union's own path when it has one real member. Lets
 * another walk (the runtime required-key check) address the same rows.
 */
export const unionMemberPaths = (path: string, members: readonly JsonValue[]): (string | null)[] => {
  const nonNull = members.map((node, index) => ({ node, index })).filter(({ node }) => !isNullSchema(node));
  const paths: (string | null)[] = members.map(() => null);
  if (nonNull.length === 1) {
    paths[nonNull[0].index] = path;
    return paths;
  }
  const keys = memberKeys(
    () => undefined,
    nonNull.map(({ node }) => ({ node, seen: new Set<string>() }))
  );
  const used = new Set<string>();
  nonNull.forEach(({ index }, position) => {
    keys[position].forEach((key, keyIndex) => {
      const plain = `${path}|${key}`;
      const memberPath = used.has(plain) ? `${plain}~${position}` : plain;
      used.add(plain);
      if (keyIndex === 0) paths[index] = memberPath;
    });
  });
  return paths;
};

const isUnder = (path: string, prefix: string): boolean =>
  [".", "[", "{", "|"].some((separator) => path.startsWith(prefix + separator));

const DEFAULT_FALSE = new Set(["nullable", "closed", "closedBranchConflict"]);

const rowDiffs = (path: string, spec: TFactRow, zod: TFactRow): TFactDiff[] =>
  [...new Set([...Object.keys(spec), ...Object.keys(zod)])].flatMap((attr) => {
    const left = spec[attr] ?? (DEFAULT_FALSE.has(attr) ? false : undefined);
    const right = zod[attr] ?? (DEFAULT_FALSE.has(attr) ? false : undefined);
    return left === right ? [] : [{ path, attr, spec: left, zod: right }];
  });

/** Diff two fact maps. A path present on one side only is reported once; its descendants are not. */
export const diffFacts = (spec: TFacts, zod: TFacts): TFactDiff[] => {
  const out: TFactDiff[] = [];
  const missing: string[] = [];
  for (const path of [...new Set([...spec.keys(), ...zod.keys()])].sort(compareCodeUnits)) {
    if (missing.some((prefix) => isUnder(path, prefix))) continue;
    const a = spec.get(path);
    const b = zod.get(path);
    if (a && b) {
      out.push(...rowDiffs(path, a, b));
      continue;
    }
    out.push({ path, attr: a ? "missing-in-zod" : "missing-in-spec", spec: Boolean(a), zod: Boolean(b) });
    missing.push(path);
  }
  return out;
};

/** A resolver over a document's local pointers, for `collectFacts`. */
export const pointerResolver =
  (document: JsonObject): TResolver =>
  (ref) =>
    ref === "#" ? document : resolvePointer(document, ref);
