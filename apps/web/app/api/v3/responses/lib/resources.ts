import { z } from "zod";
import {
  zResponseAnswer,
  zResponseAnswerBase,
  zResponseContact,
  zResponseEmbeddedDatum,
  zResponseListItem,
  zResponseRawValue,
  zResponseResolution,
  zResponseResource,
  zResponseSelection,
  zResponseTag,
  zResponseUnresolvedEntry,
  zResponseValueMatch,
} from "@formbricks/api-v3-schemas";

/**
 * The response payload the v3 contract publishes, as Zod.
 *
 * Generated from `docs/api-v3-reference/src/` (package `@formbricks/api-v3-schemas`), so the spec is the
 * only place a field is defined; this module gives the generated schemas the names the serializers,
 * the MCP output schemas and the integration test use, and adds the one composition the generator
 * cannot emit. The serializers return these types, so mapping code that disagrees with the contract
 * does not compile.
 *
 * Nothing validates at runtime on the HTTP read path — the serializer is the only producer, and a Zod
 * pass per row would buy nothing a test does not. MCP does validate: these are its tools'
 * `outputSchema`s, checked on every structured result.
 */

/** Every element type the contract names. `resources.contract.test.ts` holds it to the survey model. */
export const V3_ELEMENT_TYPES = zResponseAnswerBase.shape.elementType.options;

export const ZV3ResponseValueMatch = zResponseValueMatch;
export type TV3ResponseValueMatch = z.infer<typeof ZV3ResponseValueMatch>;

export const ZV3ResponseSelection = zResponseSelection;
export type TV3ResponseSelection = z.infer<typeof ZV3ResponseSelection>;

/**
 * Sub-field ids for the two composite element types, in storage order.
 *
 * Hand-written on purpose: the contract publishes the eleven ids as one enum, but the split — and the
 * order within each half — is a storage fact. `address` and `contactInfo` are positional `string[]`s
 * of fixed length (6 and 5), so a slot index only means anything against these lists, and dropping a
 * blank slot would shift every later value onto the wrong field. The contract test holds their
 * concatenation to the published enum.
 */
export const V3_ADDRESS_FIELD_IDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;
export const V3_CONTACT_INFO_FIELD_IDS = ["firstName", "lastName", "email", "phone", "company"] as const;

/**
 * The four shapes `data` and `unresolved[].rawValue` may carry (`ResponseRawValue`).
 *
 * Two boundaries publish stored JSON and neither can trust it. `Response.data` is a `Json` column
 * written by four APIs over several years: it holds JSON `null`s (`answers.ts` skips them for exactly
 * this reason), arrays with non-string items, and records with non-string values. None of those are
 * in this union, and `Response.json` does not validate — so a legacy row would reach a caller as a body
 * the committed OpenAPI rejects. `narrowToPublishableValue` is the only way a stored value should enter
 * either field.
 */
export const ZV3ResponseRawValue = zResponseRawValue;
export type TV3ResponseRawValue = z.infer<typeof ZV3ResponseRawValue>;

/**
 * A stored value if the contract can carry it, `undefined` if it cannot.
 *
 * `undefined` rather than a throw or a coerced stand-in: the caller decides what an unpublishable
 * byte means in its position. `serializeAnswers` already treats it as "skip" and the `unresolved[]`
 * collector as "do not report", which is the answer the resolver gives for a value it cannot coerce.
 *
 * Deliberately a parse rather than a `typeof` check. Two of the four members are element-wise —
 * `string[]` and `Record<string, string>` — and `typeof raw === "object"` passes `[1, 2]` and
 * `{ a: 5 }`, which is exactly the gap that let unvalidated legacy values onto the wire.
 */
export const narrowToPublishableValue = (raw: unknown): TV3ResponseRawValue | undefined => {
  const parsed = ZV3ResponseRawValue.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
};

/**
 * Nine value shapes across seventeen element types, discriminated on `elementType`.
 *
 * Rebuilt from the generated members rather than used as generated. The contract maps seventeen
 * element types onto nine schemas, and the generator turns a many-to-one mapping into one union option
 * per element type — nearly doubling the JSON Schema the MCP server advertises for every response tool.
 * Its normalizer drops the redundant mapping (each member's own `elementType` enum carries it), which
 * leaves a plain `z.union`; re-wrapping its members as a discriminated union restores dispatch on
 * `elementType`, the `oneOf` the contract publishes, and errors that name the one matching variant.
 *
 * Switch on `elementType` rather than probing for which value field is present: several types share
 * a shape (the four numeric scales, the four choice styles, the two composites) and the shared ones
 * are indistinguishable by their fields alone.
 */
export const ZV3ResponseAnswer = z.discriminatedUnion("elementType", zResponseAnswer.options);
export type TV3ResponseAnswer = z.infer<typeof ZV3ResponseAnswer>;

export const ZV3ResponseEmbeddedDatum = zResponseEmbeddedDatum;
export type TV3ResponseEmbeddedDatum = z.infer<typeof ZV3ResponseEmbeddedDatum>;

export const ZV3ResponseUnresolvedEntry = zResponseUnresolvedEntry;
export type TV3ResponseUnresolvedEntry = z.infer<typeof ZV3ResponseUnresolvedEntry>;

export const ZV3ResponseResolution = zResponseResolution;
export type TV3ResponseResolution = z.infer<typeof ZV3ResponseResolution>;

export const ZV3ResponseTag = zResponseTag;
export type TV3ResponseTag = z.infer<typeof ZV3ResponseTag>;

export const ZV3ResponseContact = zResponseContact;
export type TV3ResponseContact = z.infer<typeof ZV3ResponseContact>;

/** The list view. Carries `answers` and `embeddedData` too, or a list forces an N+1 of item GETs. */
export const ZV3ResponseListItem = zResponseListItem.extend({ answers: z.array(ZV3ResponseAnswer) });
export type TV3ResponseListItem = z.infer<typeof ZV3ResponseListItem>;

/** The detailed view: the list item plus the four fields a single-row read adds. */
export const ZV3ResponseResource = zResponseResource.extend({ answers: z.array(ZV3ResponseAnswer) });
export type TV3ResponseResource = z.infer<typeof ZV3ResponseResource>;
