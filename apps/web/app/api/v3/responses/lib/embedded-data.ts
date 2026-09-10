import {
  RESERVED_FIELD_CATALOG,
  type TEmbeddedValueResponse,
  type TLinkedEmbeddedField,
  type TReservedFieldCatalogEntry,
  redactUrlQuery,
  resolveEmbeddedValue,
} from "@formbricks/types/embedded-data-resolver";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";
import type { TV3ResponseEmbeddedDatum } from "./resources";

/**
 * The `embeddedData[]` projection: hidden fields, variables and auto-captured context as one
 * collection.
 *
 * Four of the rules below are this API's own rather than the shipped model's, and in two cases the
 * shipped read seam does the opposite. That is deliberate and it is why this module exists instead
 * of a call to `projectReservedValues` — which is also unusable here for a simpler reason: it
 * returns `Record<string, string | number>`, stringifying booleans, and the contract's `type` field
 * has to stay honest.
 */

/** The `display: "none"` entries: the response's own identity and timing. */
const isProjectable = (entry: TReservedFieldCatalogEntry): boolean => entry.display !== "none";

/**
 * Never projected, in any view.
 *
 * A v3 rule, not a catalog behaviour — the catalog reads `ipAddress` like any other field and the
 * dashboard shows it. Nothing here suppresses it on our behalf, so this list is the suppression.
 */
const NEVER_PROJECTED = new Set(["ipAddress"]);

export interface TV3EmbeddedDataPlan {
  /** The survey's own declarations: hidden fields and variables, each with its storage key. */
  declared: readonly TLinkedEmbeddedField[];
  /** Catalog entries this survey may project. */
  reserved: readonly TReservedFieldCatalogEntry[];
}

/**
 * Decide once per survey which entries can appear, so a page of responses does not redo it per row.
 *
 * **Nothing is shadowed.** A survey created before the reserved names were enforced can declare a
 * hidden field called `country` while the auto-captured `country` also exists, and both are real
 * values the response carries. Dropping one would hide data the author can see on the response card,
 * which keeps both for exactly that reason — so v3 keeps both too rather than being the one reader
 * that silently picks a winner. `kind` is what tells them apart, and the collection's key is
 * therefore unique per kind rather than across the whole array. The set of such surveys is finite
 * and no longer growing (ENG-3121).
 */
export const buildEmbeddedDataPlan = (declared: readonly TLinkedEmbeddedField[]): TV3EmbeddedDataPlan => ({
  declared,
  reserved: RESERVED_FIELD_CATALOG.filter(
    (entry) => isProjectable(entry) && !NEVER_PROJECTED.has(entry.name)
  ),
});

const KIND_BY_SOURCE = { ingested: "ingested", computed: "computed" } as const;

const typeOf = (value: string | number | boolean): TV3ResponseEmbeddedDatum["type"] =>
  typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";

/**
 * Project one response's embedded data.
 *
 * Entries that resolve to nothing are omitted rather than carried with a null: the collection
 * describes what the response holds, not what the survey declares. `resolveEmbeddedValue` already
 * falls back to a field's `defaultValue` before giving up, so a declared field with a default is
 * never absent.
 */
export const serializeEmbeddedData = (
  plan: TV3EmbeddedDataPlan,
  response: TEmbeddedValueResponse
): TV3ResponseEmbeddedDatum[] => {
  const entries: TV3ResponseEmbeddedDatum[] = [];

  for (const { field, link } of plan.declared) {
    // `reserved` cannot appear among a survey's own declarations, and the resolver returns
    // `undefined` for it. Narrowing here rather than after the call keeps the `kind` lookup total.
    if (field.source === "reserved") continue;

    const value = resolveEmbeddedValue({ field, link }, response);
    if (value === undefined) continue;

    entries.push({
      // The field's name, which is also the key a write accepts. Deliberately not `link.storageKey`:
      // that is its cuid for a variable, an internal id with no job in a public payload now that the
      // `variables` map it used to join back to has left the contract.
      key: field.name,
      kind: KIND_BY_SOURCE[field.source],
      type: typeOf(value),
      label: field.name,
      value,
    });
  }

  for (const entry of plan.reserved) {
    const value = resolveEmbeddedValue({ entry }, response);
    if (value === undefined) continue;

    entries.push({
      key: entry.name,
      kind: "reserved",
      type: typeOf(value),
      label: formatFieldNameToTitleCase(entry.name),
      // `redactQuery` is applied by the shipped projection, not by `resolveEmbeddedValue` — so a
      // caller of the resolver alone gets the raw `url`, single-use token and all. Applied here for
      // that reason; it is total and idempotent, so a doubly-redacted value is unchanged.
      value: entry.privacy === "redactQuery" && typeof value === "string" ? redactUrlQuery(value) : value,
    });
  }

  return entries;
};
