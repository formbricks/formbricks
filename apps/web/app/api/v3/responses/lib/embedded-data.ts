import {
  RESERVED_FIELD_CATALOG,
  type TEmbeddedValueResponse,
  type TLinkedEmbeddedField,
  type TReservedFieldCatalogEntry,
  redactUrlQuery,
  resolveEmbeddedValue,
} from "@formbricks/types/embedded-data-resolver";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";
import type { TV3ResponseEmbeddedDatum, TV3ResponseUnresolvedEntry } from "./resources";

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
 *
 * **An element id is the one thing that does shadow, because ingest already decided it.** A
 * declared *ingested* field whose storage key is also an element id can never hold a value: the
 * ingest contract drops it with `element_id_collision` (`packages/types/embedded-data-ingest.ts`)
 * on the grounds that a question answer owns that address and an answer is never rewritten, and
 * the renderer filters the same key before a submission can carry it. So the value stored under
 * that key is the respondent's answer. Projecting it here would republish an answer as
 * caller-supplied context — and a `PATCH` clearing that "field" would delete the answer.
 *
 * Only `ingested` fields are excluded, matching the contract's own order: a variable's value lives
 * in `response.variables`, keyed by its cuid, so it shares no slot with an answer and is dropped by
 * nothing. Matching is exact and case-sensitive for the same reason it is there — the storage key
 * is the literal `response.data` key, and a field differing only by case addresses another slot.
 */
export const buildEmbeddedDataPlan = (
  declared: readonly TLinkedEmbeddedField[],
  elementIds: Iterable<string> = []
): TV3EmbeddedDataPlan => {
  const claimedByElement = new Set(elementIds);

  return {
    declared: declared.filter(
      ({ field, link }) => field.source !== "ingested" || !claimedByElement.has(link.storageKey)
    ),
    reserved: RESERVED_FIELD_CATALOG.filter(
      (entry) => isProjectable(entry) && !NEVER_PROJECTED.has(entry.name)
    ),
  };
};

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
): { embeddedData: TV3ResponseEmbeddedDatum[]; unresolved: TV3ResponseUnresolvedEntry[] } => {
  const entries: TV3ResponseEmbeddedDatum[] = [];
  const unresolved: TV3ResponseUnresolvedEntry[] = [];

  for (const { field, link } of plan.declared) {
    // `reserved` cannot appear among a survey's own declarations, and the resolver returns
    // `undefined` for it. Narrowing here rather than after the call keeps the `kind` lookup total.
    if (field.source === "reserved") continue;

    const value = resolveEmbeddedValue({ field, link }, response);
    if (value === undefined) {
      // A legacy row can hold an array or an object under a declared field's key. The resolver
      // coerces nothing and returns `undefined`, and `data` no longer carries these keys on the
      // wire — so without this the bytes would be visible nowhere at all, which is silent loss on
      // exactly the old rows the name-keyed restructure was meant to protect.
      const stored = storedValueFor(field.source, link.storageKey, response);
      if (stored !== undefined && stored !== null && typeof stored === "object") {
        unresolved.push({
          key: field.name,
          rawValue: stored as TV3ResponseUnresolvedEntry["rawValue"],
          reason: "valueShapeMismatch",
        });
      }
      continue;
    }

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

  return { embeddedData: entries, unresolved };
};

/**
 * The raw stored value behind a declared field, for reporting one the resolver could not read.
 *
 * A `locked` field deliberately ignores what the response holds, so it is left alone here too —
 * reporting a value the field would never have used would be noise, not disclosure.
 */
const storedValueFor = (
  source: "ingested" | "computed",
  storageKey: string,
  response: TEmbeddedValueResponse
): unknown => (source === "computed" ? response.variables[storageKey] : response.data[storageKey]);
