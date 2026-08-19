import { z } from "zod";
import type { TContactAttributeKey } from "./contact-attribute-key";
import type { TEmbeddedData, TEmbeddedDataType, TSurveyEmbeddedData } from "./embedded-data";
import { type TLegacyEmbeddedFields, toDesiredEmbeddedFields } from "./embedded-data-mapping";
import type { TI18nString } from "./i18n";
import type { TResponse, TResponseVariables } from "./responses";
import { formatSnakeCaseToTitleCase } from "./safe-identifier";
import type { TSurveyBlocks } from "./surveys/blocks";
import { getTextContent } from "./surveys/validation";

/**
 * What a resolved Embedded Data value can be. A `date` field resolves to its ISO 8601 string, not a
 * `Date` — machine-facing values stay ISO/UTC; display formatting is the consumer's job. One gap to
 * inherit consciously (ENG-1837/1839): today's recall formatters recognize date-ONLY strings
 * (`isValidDateString` in packages/surveys; `formatStoredDateForDisplay` in apps/web, which runs
 * only on the responseData branch), so a datetime resolved from a `Date` renders verbatim until the
 * consumers learn to format it. Booleans come from `boolean`-dataType stored fields (legal on
 * ingested rows) as well as reserved reads; {@link projectReservedValues} stringifies them for the
 * recall/logic maps, and direct resolver callers own their own boolean handling.
 */
export type TResolvedEmbeddedValue = string | number | boolean;

/**
 * The slice of a response the read seam consumes. A full `TResponse` is assignable, but resolvers
 * and reserved-catalog accessors are typed against this slice so they can never depend on fields
 * the seam doesn't own (contact, tags, display bookkeeping) — and so tests and future callers that
 * only hold partial data don't have to fabricate them.
 */
export type TEmbeddedValueResponse = Pick<
  TResponse,
  | "id"
  | "surveyId"
  | "createdAt"
  | "updatedAt"
  | "finished"
  | "language"
  | "data"
  | "variables"
  | "ttc"
  | "meta"
>;

/**
 * The slice a client holds **mid-survey**, while the respondent is still answering.
 *
 * What it omits is the point: `id`, `createdAt` and `updatedAt` are assigned by the database, and
 * `finished` is only true once the respondent reaches the end — so none of them exist, or are
 * final, at the moment a survey wants to recall a reserved value into visible copy. Typing the
 * client seam against this narrower slice is what makes {@link projectClientReservedValues} able to
 * refuse a server-only accessor at compile time instead of fabricating `id: ""`,
 * `createdAt: new Date()` and `finished: false` to satisfy the wider type — fabrications that would
 * resolve to values no response ever carried.
 */
export type TClientEmbeddedValueResponse = Pick<
  TEmbeddedValueResponse,
  "surveyId" | "language" | "data" | "variables" | "ttc" | "meta"
>;

/**
 * What a reserved-catalog accessor may return. Confined to scalars and `Date` on purpose: an entry
 * that could return `meta` or `data` wholesale would leak objects into the value maps, and the
 * compiler stops that here rather than a runtime check discovering it per response.
 */
export type TReservedFieldRawValue = string | number | boolean | Date | null | undefined;

/**
 * **When** a reserved field's value can be known — not who is allowed to see it.
 *
 * - `client` — knowable in the browser while the respondent is still answering.
 * - `server` — only knowable once the request reaches the API, or once the row exists.
 * - `both` — knowable on either side, and both sides agree.
 *
 * This gates what the mid-survey surfaces may offer: the recall and logic pickers inside a running
 * survey can only list fields the renderer can actually resolve at that moment (ENG-1840), and
 * {@link projectClientReservedValues} is the seam that enforces it. Server-side readers — exports,
 * filters, summaries — ignore this and read the whole catalog, because by then everything is known.
 */
export type TReservedFieldAvailability = "client" | "server" | "both";

/**
 * What the "Anonymize responses" toggle does to a reserved field at ingest.
 *
 * - `keep` — carries no information about who or where the respondent is; stored unchanged.
 * - `drop` — not captured at all while anonymizing.
 * - `redactQuery` — captured, but with the query string stripped, because that is where the
 *   identifying part hides (a `?email=` or `?uid=` carried in a page URL) while the path itself is
 *   the part analytics needs.
 *
 * Declared here rather than at the ingest routes so the classification lives next to the field it
 * describes and a new entry cannot be added without deciding it. **Nothing consumes this yet** —
 * the toggle does not exist on this branch; this is the catalog stating its own policy ahead of the
 * surface that will apply it, so that surface has no per-field list of its own to drift from.
 */
export type TReservedFieldPrivacy = "keep" | "drop" | "redactQuery";

/**
 * What every reserved field declares regardless of which side can read it.
 *
 * A reserved field is auto-captured system metadata every survey can reference without declaring
 * anything (see `ZEmbeddedDataSource` — reserved fields are never stored as rows).
 */
interface TReservedFieldCatalogEntryBase {
  /**
   * The key consumers reference the field by — the recall token id, the logic operand, the key in
   * the projected value map. This is the "storageKey" of a reserved field, except nothing is
   * stored: the name only ever addresses catalog reads.
   */
  name: string;
  dataType: TEmbeddedDataType;
  privacy: TReservedFieldPrivacy;
}

/**
 * A field only the server can read, because its accessor needs part of a persisted response.
 */
export interface TServerReservedFieldCatalogEntry extends TReservedFieldCatalogEntryBase {
  availability: Extract<TReservedFieldAvailability, "server">;
  /**
   * Reads the raw value off a response. Coercion to `dataType` is the resolver's job, not the
   * accessor's. Accessors should be total functions; one that throws is treated as "nothing
   * captured" by the resolver rather than crashing the caller.
   */
  read: (response: TEmbeddedValueResponse) => TReservedFieldRawValue;
}

/**
 * A field a client can read mid-survey. Its accessor is typed against
 * {@link TClientEmbeddedValueResponse}, so marking an entry `client`/`both` while reading `finished`
 * or `createdAt` is a **compile error** rather than a value that silently resolves to whatever the
 * caller happened to fabricate. That is the whole reason the entry type is a union: the availability
 * claim and the accessor's real dependencies cannot drift apart.
 *
 * A narrower parameter also means such an accessor stays callable with a full response, so
 * {@link resolveEmbeddedValue} and {@link projectReservedValues} treat both variants identically.
 */
export interface TClientReservedFieldCatalogEntry extends TReservedFieldCatalogEntryBase {
  // Everything that is not `server` is client-readable, spelled as the complement rather than a
  // second literal list so a fourth availability value cannot be added without landing in one of the
  // two variants — and therefore without deciding which response slice its accessor may read.
  availability: Exclude<TReservedFieldAvailability, "server">;
  read: (response: TClientEmbeddedValueResponse) => TReservedFieldRawValue;
}

/**
 * One reserved field.
 *
 * The response location is a typed accessor rather than a dot-path string. Reserved fields are a
 * static catalog in code, so the "path" can be code too — which makes an entry that points at a
 * nonexistent response field a compile error instead of a silent `undefined`, needs no path-walking
 * machinery whose edge cases would have to be tested separately, and lets an entry compute (unit
 * conversion, redaction) instead of only fetching.
 */
export type TReservedFieldCatalogEntry = TServerReservedFieldCatalogEntry | TClientReservedFieldCatalogEntry;

/**
 * **The production reserved-field catalog — Tier 1.** Auto-captured system metadata every survey can
 * reference by name without declaring anything. A static list in code, never rows in the
 * `EmbeddedData` table and never a per-survey link: the list is identical for every workspace and
 * keeps growing, so adding a field stays a code change rather than a data migration, and there is
 * nothing to migrate anyway — the values already sit on every response ever stored.
 *
 * Every entry therefore resolves against historical responses too, which is why each accessor
 * tolerates the field being absent rather than assuming today's ingest shape.
 *
 * `name` collisions are real and deliberate: a survey may already declare a hidden field called
 * `country` or `url`, and `RESERVED_FIELD_NAMES` (reserved-field-names.ts) keeps only *new*
 * declarations off these names. Existing surveys keep resolving their own field — see the per-survey
 * precedence rule this catalog is paired with.
 *
 * Not in Tier 1, on purpose:
 * - `status` — `Response` has no status column, and `finished` already carries the only distinction
 *   that exists (complete vs. partial). Deriving a second spelling of the same bit would give two
 *   names for one fact.
 *
 * The browser-runtime block at the end of the list arrived with ENG-1841, which gave `ZResponseMeta`
 * a home for those values and taught the renderer to snapshot them at display time. They are all
 * `client`: the renderer reads them itself, so a mid-survey picker can offer them and the renderer
 * really can resolve them. Responses collected before that shipped carry none of them and resolve as
 * unset — expected, and the reason every accessor tolerates absence.
 */
export const RESERVED_FIELD_CATALOG: readonly TReservedFieldCatalogEntry[] = [
  /** How the response was collected — `link`, `app`, … Set by the client on the response input. */
  { name: "source", dataType: "string", availability: "client", privacy: "keep", read: (r) => r.meta.source },
  /**
   * The page the survey ran on. `redactQuery`, not `drop`: the path is what analytics needs, while a
   * query string is where an identifier rides along (`?email=`, `?uid=`).
   */
  {
    name: "url",
    dataType: "string",
    availability: "client",
    privacy: "redactQuery",
    read: (r) => r.meta.url,
  },
  /**
   * Geo-IP country, resolved from the request in the ingest routes — nothing client-side knows it.
   */
  {
    name: "country",
    dataType: "string",
    availability: "server",
    privacy: "drop",
    read: (r) => r.meta.country,
  },
  /** The action that triggered an app survey. */
  { name: "action", dataType: "string", availability: "client", privacy: "keep", read: (r) => r.meta.action },
  /**
   * browser/os/deviceType are `server` because that is where they come from: `UAParser` runs over
   * the `user-agent` request header in the ingest routes (see the v1/v2 client response routes), and
   * nothing client-side produces them on this branch. Marking them `client` would let a mid-survey
   * picker offer a field the renderer cannot resolve. They flip to `both` only once a client
   * actually captures them.
   */
  {
    name: "browser",
    dataType: "string",
    availability: "server",
    privacy: "drop",
    read: (r) => r.meta.userAgent?.browser,
  },
  {
    name: "os",
    dataType: "string",
    availability: "server",
    privacy: "drop",
    read: (r) => r.meta.userAgent?.os,
  },
  {
    name: "deviceType",
    dataType: "string",
    availability: "server",
    privacy: "drop",
    read: (r) => r.meta.userAgent?.device,
  },
  /** Only captured when the survey has IP capture enabled, so unset on most responses. */
  {
    name: "ipAddress",
    dataType: "string",
    availability: "server",
    privacy: "drop",
    read: (r) => r.meta.ipAddress,
  },
  /**
   * Complete vs. partial. `server`, because mid-survey the answer is always "not yet" — offering it
   * to a running survey would mean offering a constant `false`.
   */
  { name: "finished", dataType: "boolean", availability: "server", privacy: "keep", read: (r) => r.finished },
  /** The language the respondent is answering in; known on both sides and agreed between them. */
  { name: "language", dataType: "string", availability: "both", privacy: "keep", read: (r) => r.language },
  /**
   * responseId/surveyId are `server` by decision, not by limitation — a client does know its survey
   * id. Internal identifiers have no business being recalled into copy a respondent reads, and
   * `availability` is what the mid-survey pickers filter on. They stay in the catalog because
   * server-side readers (exports, filters, webhooks) legitimately want them as columns.
   */
  { name: "responseId", dataType: "string", availability: "server", privacy: "keep", read: (r) => r.id },
  { name: "surveyId", dataType: "string", availability: "server", privacy: "keep", read: (r) => r.surveyId },
  /**
   * Total time to complete. **Only meaningful on finished responses**: `calculateTtcTotal` is the
   * only writer of `ttc._total`, and every call site guards it behind `finished ?` (e.g.
   * apps/web/app/api/v2/client/[workspaceId]/responses/lib/response.ts:64, the v1 client and
   * management routes, and apps/web/lib/response/service.ts). On a partial response the key is
   * absent and this resolves as unset — deliberately, rather than summing the per-element entries to
   * invent a "duration so far" that no other surface reports.
   *
   * The stored `ttc` values are **milliseconds** (see `MAX_RESPONSE_TTC` in responses.ts), so the
   * accessor converts. The field is named and typed in seconds, and a typed accessor is exactly what
   * lets the catalog honor that instead of publishing a `durationSeconds` holding milliseconds.
   */
  {
    name: "durationSeconds",
    dataType: "number",
    availability: "server",
    privacy: "keep",
    read: (r) => {
      const totalMs = r.ttc?._total;
      return typeof totalMs === "number" ? Math.round(totalMs / 1000) : undefined;
    },
  },
  /**
   * startedAt/finishedAt map onto the row's timestamps: `createdAt` is when the response record was
   * opened, `updatedAt` when it was last written — which for a finished response is its submission.
   * Both resolve to ISO strings, never `Date` objects (see {@link TResolvedEmbeddedValue}).
   *
   * `finishedAt` is `updatedAt` and therefore only means "finished at" on a finished response; on a
   * partial one it is the last partial write. The pair is the closest honest reading of the columns
   * that exist — `Response` stores no separate completion timestamp.
   */
  { name: "startedAt", dataType: "date", availability: "server", privacy: "keep", read: (r) => r.createdAt },
  {
    name: "finishedAt",
    dataType: "date",
    availability: "server",
    privacy: "keep",
    read: (r) => r.updatedAt,
  },
  /**
   * **Browser-runtime context (ENG-1841).** Captured by the renderer itself and frozen at display,
   * which is why every one of these is `client`: unlike browser/os/deviceType — which only exist
   * because the ingest route parses a request header — the values below are read in the page and
   * travel in on the response input, and that is exactly what makes them resolvable mid-survey.
   *
   * Both link and app surveys render through the same component, so all twelve are captured for
   * both. What they *describe* differs: on a link survey `pagePath`/`pageReferrer`/`utm*` are about
   * the Formbricks-hosted survey page and how the respondent reached it; on an app survey they are
   * about the host page the survey was triggered on.
   */
  /**
   * The page the response was answered on, without the query string — the field to group on when you
   * want the page rather than the visit. It needs no redaction because it never carries an
   * identifier; the full URL lives on `url`, which is `redactQuery` for exactly that reason.
   *
   * There is deliberately no `pageUrl`: it read `location.href`, which is the same expression `url`
   * already reads in the same snapshot, so the two were byte-identical on every response rather
   * than merely similar. `url` plus `pagePath` covers it with nothing duplicated.
   */
  {
    name: "pagePath",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.pagePath,
  },
  /**
   * Where the respondent came from. `redactQuery`: a referrer URL is as capable of carrying a token
   * or an email in its query string as any other, and the referring *page* is the whole signal.
   */
  {
    name: "pageReferrer",
    dataType: "string",
    availability: "client",
    privacy: "redactQuery",
    read: (r) => r.meta.pageReferrer,
  },
  /**
   * Campaign attribution, parsed from the page's own `utm_*` query params. `keep`: these exist to be
   * read — a campaign name is marketing metadata the respondent's own link advertised, not something
   * they disclosed about themselves. A param that was absent or empty is absent here, never `""`.
   */
  {
    name: "utmSource",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.utmSource,
  },
  {
    name: "utmMedium",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.utmMedium,
  },
  {
    name: "utmCampaign",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.utmCampaign,
  },
  {
    name: "utmTerm",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.utmTerm,
  },
  {
    name: "utmContent",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.utmContent,
  },
  /**
   * Screen and viewport, in CSS pixels. `number`, not string, so a logic condition can compare them
   * (`viewportWidth < 768`) instead of comparing digit strings. Screen is the device; viewport is
   * the window the survey was actually rendered into — the pair is what distinguishes a phone from a
   * narrow window on a large monitor.
   */
  {
    name: "screenWidth",
    dataType: "number",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.screenWidth,
  },
  {
    name: "screenHeight",
    dataType: "number",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.screenHeight,
  },
  {
    name: "viewportWidth",
    dataType: "number",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.viewportWidth,
  },
  {
    name: "viewportHeight",
    dataType: "number",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.viewportHeight,
  },
  /**
   * The respondent's IANA time zone (`Europe/Berlin`), not an offset — it survives DST and is what a
   * "best hour to send" question is actually asking about. Distinct from `language`, which is the
   * language they are answering in: a zone is where they are, a language is how they read.
   */
  {
    name: "timezone",
    dataType: "string",
    availability: "client",
    privacy: "keep",
    read: (r) => r.meta.timezone,
  },
];

/**
 * The slice of a stored field definition the resolver needs — `TEmbeddedData` minus the ownership
 * and bookkeeping columns. `source` stays the full enum even though `ZEmbeddedData` rejects
 * `"reserved"` rows: narrowing it here would force every caller holding a parsed row to re-prove
 * at runtime what the schema already guaranteed. A row that still claims `"reserved"` resolves to
 * `undefined` (see {@link resolveEmbeddedValue}).
 */
export type TResolvableEmbeddedField = Pick<TEmbeddedData, "source" | "dataType" | "defaultValue" | "locked">;

/** The slice of the survey link the read seam needs: the key the value is stored under in the response. */
export type TEmbeddedDataLink = Pick<TSurveyEmbeddedData, "storageKey">;

/**
 * A reference to one embedded value on a response. Two shapes because the data model has two:
 * a stored field is only addressable through the survey link that carries its `storageKey`, while
 * a reserved field has no link and no storage — only a catalog entry. Modeling this as a union
 * makes the mismatch unrepresentable: there is no way to hand the resolver a catalog entry with a
 * storage key, or a stored field without one.
 *
 * The `?: never` exclusion props are what make that claim actually hold. Against a bare union,
 * TypeScript's excess-property check admits keys from any constituent, so a mixed
 * `{ field, link, entry }` object would compile and the resolver would have to pick a winner
 * silently; with the exclusions it is a compile error instead.
 */
export type TEmbeddedValueRef =
  | { field: TResolvableEmbeddedField; link: TEmbeddedDataLink; entry?: never }
  | { entry: TReservedFieldCatalogEntry; field?: never; link?: never };

/**
 * A stored field definition paired with the survey link that addresses it — the unit
 * {@link listReadableFields} enumerates and {@link deriveLegacyEmbeddedData} synthesizes. The pair
 * is assignable to {@link TEmbeddedValueRef}, so whatever a caller lists it can also resolve,
 * without repackaging.
 */
export interface TLinkedEmbeddedField {
  field: TResolvableEmbeddedField & Pick<TEmbeddedData, "name">;
  link: TEmbeddedDataLink;
}

/**
 * Mirrors the date rule `ZEmbeddedData` pins for `date` default values (kept private there on
 * purpose — this module owns read-side semantics, that one owns the row schema).
 */
const ZIsoDateOrDateTime = z.union([z.iso.date(), z.iso.datetime()]);

/**
 * Coerces a raw stored value to a field's `dataType`, returning `undefined` when the value cannot
 * honestly represent one. This is the single vocabulary of read-side coercion — every tier of
 * {@link resolveEmbeddedValue} (stored value, reserved read, default value) goes through it, so a
 * resolved value always agrees with its declared `dataType` no matter which tier produced it.
 *
 * The rules, and why:
 * - `null`, `undefined` and non-scalars (`string[]`, `Record<string, string>`) are missing. Response
 *   data shares one map with question answers, so a multi-select array or matrix record under the
 *   storage key means the key collided with an element id — joining it into a string would invent a
 *   value the respondent never provided for this field.
 * - `string`: strings pass through unchanged, including `""` — an ingested empty string is a present
 *   value, and whether to display something else is the consumer's fallback logic, not data
 *   semantics. Numbers, booleans and valid dates stringify losslessly.
 * - `number`: finite numbers and non-blank numeric strings. Blank strings are missing, never `0`
 *   (`Number("") === 0` is a coercion artifact, not data).
 * - `boolean`: booleans, and exactly `"true"`/`"false"` (case-insensitive, trimmed) — the URL-param
 *   spelling. `1`/`"yes"`/`"on"` stay uncoercible: guessing truthiness is write-side ingest policy
 *   (ENG-1845), and the read seam must not resolve a value ingest would have rejected.
 * - `date`: `Date` instances become ISO strings; strings must be an ISO 8601 date (`2026-08-06`)
 *   or UTC datetime (`2026-08-06T10:30:00Z`) — the exact subset `ZEmbeddedData` pins for date
 *   defaults. That deliberately excludes offset (`+02:00`) and zone-less datetimes, and, unlike
 *   the number and boolean arms, tolerates no surrounding whitespace — write-side ingest
 *   (ENG-1845) must normalize to this same subset, or consciously widen both rules together.
 *   Accepted strings pass through as-is, so a date-only value is not silently promoted to a
 *   midnight-UTC datetime. Epoch numbers stay uncoercible — nothing upstream produces them
 *   intentionally.
 */
export const coerceToEmbeddedDataType = (
  value: unknown,
  dataType: TEmbeddedDataType
): TResolvedEmbeddedValue | undefined => {
  if (value === null || value === undefined) return undefined;

  switch (dataType) {
    case "string": {
      if (typeof value === "string") return value;
      if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
      if (typeof value === "boolean") return String(value);
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
      return undefined;
    }
    case "number": {
      if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
      if (typeof value === "string") {
        if (value.trim() === "") return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
        return undefined;
      }
      return undefined;
    }
    case "date": {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
      if (typeof value === "string") return ZIsoDateOrDateTime.safeParse(value).success ? value : undefined;
      return undefined;
    }
  }
};

/**
 * Resolves one catalog entry against whatever response slice its accessor asks for.
 *
 * A throwing accessor reads as missing rather than escalating: one dirty response fed to a computing
 * accessor (URL parsing, unit conversion) must degrade like every other dirty input here — one field
 * unset — not abort a caller's whole render or export loop over the catalog.
 *
 * Generic over the slice so "how a reserved read resolves" has exactly one definition shared by the
 * server seam ({@link resolveEmbeddedValue}) and the mid-survey one
 * ({@link projectClientReservedValues}), which is what keeps the two from drifting on coercion or on
 * error handling.
 */
const resolveCatalogEntry = <TSlice>(
  entry: { dataType: TEmbeddedDataType; read: (response: TSlice) => TReservedFieldRawValue },
  response: TSlice
): TResolvedEmbeddedValue | undefined => {
  try {
    return coerceToEmbeddedDataType(entry.read(response), entry.dataType);
  } catch {
    return undefined;
  }
};

/**
 * The shared body of the two projections: entry name → resolved value, absent values omitted,
 * booleans stringified because the recall/logic map types have no boolean slot.
 */
const projectEntries = <TSlice>(
  entries: readonly {
    name: string;
    dataType: TEmbeddedDataType;
    read: (response: TSlice) => TReservedFieldRawValue;
  }[],
  response: TSlice
): Record<string, string | number> => {
  const values: Record<string, string | number> = {};
  for (const entry of entries) {
    const value = resolveCatalogEntry(entry, response);
    if (value === undefined) continue;
    values[entry.name] = typeof value === "boolean" ? String(value) : value;
  }
  return values;
};

/**
 * The single read seam for Embedded Data: returns one field's value from a response, or `undefined`
 * when the field has no value there. Every downstream surface (recall, logic, export, pickers)
 * will read through this once ENG-1837 repoints them, so "where does a field's value live" is
 * answered exactly once:
 *
 * - `computed` → `response.variables[storageKey]` (written by the logic engine)
 * - `ingested` → `response.data[storageKey]` (written from URL params / SDK)
 * - reserved catalog entry → wherever its typed accessor points (`meta.*`, `ttc._total`, …)
 *
 * A `locked` ingested field ignores `response.data` entirely — locking means outside writes are
 * refused, so the default IS the value; honoring a stored value here would let a crafted URL
 * override what locking promised. Missing or uncoercible values fall back to the field's
 * `defaultValue` (`null` means "no default"), which is coerced through the same rules, so the
 * result always agrees with the field's `dataType` or is `undefined`. Reserved entries have no
 * default tier: they are captured metadata, and a default would fake a capture that never happened.
 *
 * A stored row whose `source` still claims `"reserved"` resolves to `undefined` — such a row cannot
 * pass `ZEmbeddedData`, so this arm only defends against data that skipped the schema.
 *
 * ENG-1837 swap checklist — two consumer behaviors this seam deliberately does not reproduce; the
 * repointed call sites inherit these deltas and must do so consciously. The mismatched state is
 * realistic today: `performCalculation`'s `assign` (packages/surveys/src/lib/logic.ts) stores raw
 * strings into number variables unconditionally.
 * (a) `getVariableValue` in that same file evaluates a number variable as `Number(value) || 0` (its
 *     text arm collapses falsy values to `""`), so a non-numeric or empty string stored in
 *     `response.variables` is `0` to logic today — here that state is a coercion failure and
 *     resolves to defaultValue-or-`undefined`.
 * (b) Both recall paths (`replaceRecallInfo` in packages/surveys, `parseRecallInfo` in apps/web)
 *     render whatever sits in the lookup maps with no dataType awareness, so the same stored
 *     `"abc"` renders verbatim in recall today — here it resolves to defaultValue-or-`undefined`.
 * (c) On a key present in both maps, today's consumers disagree with each other —
 *     `replaceRecallInfo` lets `responseData` win (its data check runs last), `parseRecallInfo`
 *     lets `variables` win (checked first). Here the declared source is exclusive: computed reads
 *     only `variables`, ingested reads only `data`.
 * (d) A response missing a variable's key entirely (stored before the variable was added, or
 *     API-created) is `0` / `""` to logic and fallback text to recall today — here it resolves to
 *     the field's `defaultValue`, which for §8-derived pairs is the variable's declared value.
 */
export const resolveEmbeddedValue = (
  ref: TEmbeddedValueRef,
  response: TEmbeddedValueResponse
): TResolvedEmbeddedValue | undefined => {
  // Definedness, not `"entry" in ref`: the `entry?: never` exclusion prop keeps the `in` operator
  // from narrowing the union, and this way a degenerate `{ field, link, entry: undefined }` object
  // still resolves through its field instead of crashing on `undefined.read`.
  if (ref.entry !== undefined) return resolveCatalogEntry(ref.entry, response);

  const { field, link } = ref;
  if (field.source === "reserved") return undefined;

  const storedValue =
    field.source === "computed"
      ? response.variables[link.storageKey]
      : field.locked
        ? undefined
        : response.data[link.storageKey];

  const coerced = coerceToEmbeddedDataType(storedValue, field.dataType);
  if (coerced !== undefined) return coerced;
  if (field.defaultValue === null) return undefined;
  return coerceToEmbeddedDataType(field.defaultValue, field.dataType);
};

/**
 * Finds a computed field by the key its value is stored under in `response.variables`.
 *
 * Returns `undefined` when nothing matches, which is a state that reaches production: a logic
 * condition or a calculate action outlives the field it names whenever a variable is renamed or
 * deleted and the rule keeps the old storage key.
 */
export const findComputedEmbeddedField = (
  computedFields: readonly TLinkedEmbeddedField[],
  storageKey: string
): TLinkedEmbeddedField | undefined => computedFields.find((field) => field.link.storageKey === storageKey);

/**
 * The declared type of the computed field an operand names, or `undefined` when it names none.
 *
 * The optional chain is the point: both logic engines consult this to decide whether to coerce a
 * hidden-field operand to a number, and that decision is made BEFORE the operator switch. Reading
 * `.dataType` off a missing field throws there, and `evaluateSingleCondition`'s try/catch turns the
 * throw into a silent `false` — so a stale operand would quietly change which branch a respondent
 * takes, or what a quota counts, with no error anywhere. Unknown type means the coercion simply does
 * not fire and evaluation falls through exactly as it does for a text variable.
 */
export const getComputedFieldDataType = (
  computedFields: readonly TLinkedEmbeddedField[],
  storageKey: string
): TEmbeddedDataType | undefined => findComputedEmbeddedField(computedFields, storageKey)?.field.dataType;

/**
 * What the logic engines read a computed field's value as — **not** {@link resolveEmbeddedValue}.
 *
 * ENG-1837 repointed the *definition* lookup onto the EmbeddedData tables and deliberately left this
 * value expression alone. `resolveEmbeddedValue` would coerce a non-numeric stored value to the
 * field's declared default instead of `0`, and render a text field holding `0` as `"0"` rather than
 * `""` — both of which change what already-stored responses evaluate to, and responses are never
 * migrated (see the swap checklist on {@link resolveEmbeddedValue}, deltas (a) and (d)).
 *
 * Shared by `packages/surveys/src/lib/logic.ts` (the renderer) and `apps/web/lib/surveyLogic/utils.ts`
 * (quotas, summaries, follow-up conditions), which are near-copies of each other. It lives here so
 * the rule has one definition rather than two that can drift apart — the engines evaluating the same
 * survey differently is its own bug class.
 */
export const getLogicVariableValue = (
  computedFields: readonly TLinkedEmbeddedField[],
  storageKey: string,
  variablesData: TResponseVariables
): string | number | undefined => {
  const field = findComputedEmbeddedField(computedFields, storageKey);
  if (!field) return undefined;
  const variableValue = variablesData[storageKey];
  return field.field.dataType === "number" ? Number(variableValue) || 0 : variableValue || "";
};

/**
 * Resolves every catalog entry into a plain map keyed by entry name — the piece that lets reserved
 * fields ride through recall and logic with zero per-consumer special-casing. Those consumers
 * already read two maps (`variables[...]`, `responseData[...]`); merging this projection into
 * either one makes reserved values reachable by name exactly like every other field, which matters
 * because `response.meta` is not otherwise passed into the recall/logic resolvers at all.
 *
 * The value type is deliberately `string | number` so the result is assignable into both existing
 * maps: absent values are omitted (recall then falls back to its fallback text and logic sees
 * `undefined`, exactly like an absent hidden field today), and booleans are stringified to
 * `"true"`/`"false"` — what `String()` would render anyway, in a map type that has no boolean slot.
 *
 * An entry name that matches an element id or hidden field name shadows it in the merged map, which
 * is why the caller — not this function — owns precedence. `FORBIDDEN_IDS` never guarded these names
 * (only `source` overlaps), so surveys stored today can and do declare a field called `country` or
 * `url`; `RESERVED_FIELD_NAMES` (reserved-field-names.ts) stops only *new* declarations, and a
 * consumer merging this map must let an existing declared field win inside its own survey.
 */
export const projectReservedValues = (
  entries: readonly TReservedFieldCatalogEntry[],
  response: TEmbeddedValueResponse
): Record<string, string | number> => projectEntries(entries, response);

/**
 * The mid-survey counterpart of {@link projectReservedValues}: what a **client** can project while
 * the respondent is still answering.
 *
 * Two things make it a separate function rather than a flag:
 *
 * 1. It takes {@link TClientEmbeddedValueResponse}, the shape a running survey actually holds. The
 *    persisted-only fields are not optional here, they are absent — so a caller cannot be tempted to
 *    pass `id: ""`, `createdAt: new Date()` or `finished: false` and get values back that describe
 *    the fabrication rather than the response.
 * 2. It drops every `server` entry, and the type system guarantees the survivors never needed those
 *    fields in the first place (see {@link TClientReservedFieldCatalogEntry}). A server-only accessor
 *    is filtered out before it is ever invoked, so nothing throws and nothing resolves from a stub.
 *
 * Same output contract as {@link projectReservedValues} — absent values omitted, booleans
 * stringified — so a consumer can merge either one into the same recall/logic map.
 */
export const projectClientReservedValues = (
  entries: readonly TReservedFieldCatalogEntry[],
  response: TClientEmbeddedValueResponse
): Record<string, string | number> =>
  projectEntries(
    entries.filter((entry): entry is TClientReservedFieldCatalogEntry => entry.availability !== "server"),
    response
  );

/** One referenceable field, carrying the key a consumer must use to address it. */
export interface TReadableField {
  /** The reference key: element id, link `storageKey`, catalog entry name, or contact attribute key. */
  key: string;
  /** Display label for pickers. Falls back to the key when nothing better exists. */
  label: string;
}

/**
 * Everything a survey can reference, grouped. All four groups are always present (empty arrays
 * included) so consumers render stable sections instead of probing for keys. Contact attributes
 * stay their own clearly-labelled group — they describe the person, not the response, and the
 * unified picker must not blur that line.
 */
export interface TReadableFields {
  question: TReadableField[];
  embeddedData: TReadableField[];
  reserved: TReadableField[];
  contactAttribute: TReadableField[];
}

/**
 * Inputs are explicit: the field/link pairs don't live on `TSurvey` until ENG-1837 inlines them,
 * contact attribute keys are workspace-level, the reserved catalog is code — and `blocks`, which
 * does live on `TSurvey`, is taken alone so the function needs no survey object. Passing them in
 * keeps this pure and lets legacy surveys participate via {@link deriveLegacyEmbeddedData}.
 */
export interface TListReadableFieldsInput {
  /** The survey's blocks — elements live here (the legacy `questions` model is not enumerated). */
  blocks: TSurveyBlocks;
  embeddedData: readonly TLinkedEmbeddedField[];
  reservedEntries: readonly TReservedFieldCatalogEntry[];
  contactAttributeKeys: readonly Pick<TContactAttributeKey, "key" | "name">[];
  /** Language for element headlines; falls back to each headline's `default` entry. */
  languageCode?: string;
}

/**
 * Matches one full recall token (`#recall:<id>/fallback:<text>#`) — the editor's storage syntax.
 * `.replace()` only: `.test()`/`.exec()` would carry `lastIndex` across calls on this shared instance.
 */
const RECALL_TOKEN_REGEX = /#recall:[A-Za-z0-9_-]+\/fallback:[^#]*#/g;

/**
 * A blank label draws a row with nothing to read or click (the same reasoning behind
 * `ZEmbeddedData`'s name rule), and not every source guarantees a non-blank name — legacy variable
 * names and contact attribute display names are plain strings. The reference key always exists, so
 * it is the fallback, applied uniformly to all four groups.
 */
const labelOrKey = (label: string, key: string): string => (label.trim() === "" ? key : label);

/**
 * Headline → picker label: localized, HTML stripped so rich-text markup never shows raw, and recall
 * tokens flattened to `___` so storage syntax never leaks into a picker (what the apps/web pickers
 * achieve via `replaceRecallInfoWithUnderline`). Localization follows packages/surveys'
 * `getLocalizedValue` — a blank or missing locale entry falls back to the `default` entry. That is
 * deliberately NOT today's apps/web picker behavior, whose `getLocalizedValue` has no default
 * fallback, so an untranslated headline labels there as the bare element id; ENG-1840/1853 inherit
 * this as a conscious label improvement when they swap pickers onto {@link listReadableFields}.
 */
const toElementLabel = (headline: TI18nString, languageCode: string): string => {
  const localized = headline[languageCode];
  const fallback = typeof headline.default === "string" ? headline.default : "";
  const raw = typeof localized === "string" && localized.trim() !== "" ? localized : fallback;
  return getTextContent(raw).replace(RECALL_TOKEN_REGEX, "___").trim();
};

/**
 * Enumerates everything referenceable from a survey — the one list recall pickers, logic builders
 * and export columns will all read (ENG-1840/1853), so "what can I reference and by which key"
 * has a single answer. Each entry's `key` is the exact string {@link resolveEmbeddedValue} and the
 * existing map lookups address the value by:
 *
 * - question → the element id (label from its headline; the id itself when the headline is empty)
 * - embeddedData → the link's `storageKey` (never the definition's library `key` — the storage key
 *   is what recall tokens and response maps use, and the two can differ)
 * - reserved → the catalog entry name (title-cased for the label until the picker adds real labels)
 * - contactAttribute → the contact attribute key (label from its display name when one is set)
 */
export const listReadableFields = (input: TListReadableFieldsInput): TReadableFields => {
  const languageCode = input.languageCode ?? "default";

  const question = input.blocks
    .flatMap((block) => block.elements)
    .map((element) => ({
      key: element.id,
      label: labelOrKey(toElementLabel(element.headline, languageCode), element.id),
    }));

  const embeddedData = input.embeddedData.map(({ field, link }) => ({
    key: link.storageKey,
    label: labelOrKey(field.name, link.storageKey),
  }));

  const reserved = input.reservedEntries.map((entry) => ({
    key: entry.name,
    label: labelOrKey(formatSnakeCaseToTitleCase(entry.name), entry.name),
  }));

  const contactAttribute = input.contactAttributeKeys.map((attributeKey) => ({
    key: attributeKey.key,
    label: labelOrKey(attributeKey.name ?? "", attributeKey.key),
  }));

  return { question, embeddedData, reserved, contactAttribute };
};

/**
 * Maps a survey's legacy declarations (`variables`, `hiddenFields.fieldIds`) into the same
 * field/link pairs the resolver and enumerator consume — the pure-function fallback that lets
 * ENG-1837 serve surveys whose rows haven't been backfilled (migration spec §8), with no fetch
 * logic here.
 *
 * The §8 rules live in `toDesiredEmbeddedFields`, shared with ENG-1978's write bridge and ENG-1835's
 * backfill; this only reshapes them into `{field, link}` pairs and adds `locked: false`, which has no
 * legacy equivalent.
 *
 * `hiddenFields.enabled` is deliberately ignored: recall and logic consult `fieldIds` alone today,
 * and ingestion is split on the flag — the js-core SDK drops hidden fields when disabled, while the
 * link-survey URL path fills them regardless (`getHiddenFieldsFromSearchParams` receives only
 * `fieldIds`). Deriving from `fieldIds` alone therefore preserves today's read behavior exactly:
 * whatever either path stored still resolves, and what nothing stored reports as unset.
 */
export const deriveLegacyEmbeddedData = (survey: TLegacyEmbeddedFields): TLinkedEmbeddedField[] =>
  toDesiredEmbeddedFields(survey).map(({ storageKey, ...field }) => ({
    field: { ...field, locked: false },
    link: { storageKey },
  }));

/**
 * The survey slice {@link getSurveyEmbeddedFields} needs. Deliberately looser than `TSurvey`: the
 * readers this serves hold everything from a full survey to a four-key `Pick`, and every one of them
 * must be able to call the accessor without widening its own select.
 */
export interface TEmbeddedFieldsSurvey extends TLegacyEmbeddedFields {
  /** The rows, joined and inlined at load. Absent when the select omitted the join. */
  embeddedFields?: TLinkedEmbeddedField[] | null;
}

/**
 * **Where a saved survey's Embedded Data definitions come from.** Every reader outside the editor —
 * recall, logic, export columns, response filters, response tables, emails, integrations — calls
 * this and nothing else. Its counterpart is {@link getDeclaredEmbeddedFields}; between the two, no
 * reader may call {@link deriveLegacyEmbeddedData} directly, which is what keeps "exactly two named
 * decisions, and no third" a property a reviewer can check with grep.
 *
 * **The rows are the whole answer** (ENG-2412). This used to fall back to the legacy columns for a
 * survey with no rows, which is why deleting a survey's rows made its fields reappear rather than
 * disappear. The write path now writes the rows from the payload, so a survey with no rows is a
 * survey with no fields, and that is what this reports.
 *
 * **Every survey select that reaches a reader must therefore carry the join** —
 * `selectSurveyEmbeddedDataLinks`, inlined by `transformPrismaSurvey`. A select that omits it yields
 * `undefined` here and the survey reads as having no fields at all. Audited when the fallback was
 * removed: every reader gets its survey through `selectSurvey` or a select that embeds the same
 * constant.
 *
 * This is a *definition* lookup only. ENG-1837 repoints where a field's name, source and dataType
 * come from; it deliberately does not repoint value arithmetic onto {@link resolveEmbeddedValue},
 * whose coercion and default tiers differ from today's call-site expressions (see the swap checklist
 * on {@link resolveEmbeddedValue}) and would change what stored responses render as.
 */
export const getSurveyEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  survey.embeddedFields ?? [];

/** The computed (ex-variable) fields of a survey, in inlined order. */
export const getComputedEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  getSurveyEmbeddedFields(survey).filter(({ field }) => field.source === "computed");

/** The ingested (ex-hidden-field) fields of a survey, in inlined order. */
export const getIngestedEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  getSurveyEmbeddedFields(survey).filter(({ field }) => field.source === "ingested");

/** The storage keys of a survey's ingested fields — what `response.data` addresses them by. */
export const getIngestedStorageKeys = (survey: TEmbeddedFieldsSurvey): string[] =>
  getIngestedEmbeddedFields(survey).map(({ link }) => link.storageKey);

/**
 * **What a survey declares right now, ignoring what is stored.** The counterpart to
 * {@link getSurveyEmbeddedFields}; between the two, no caller needs
 * {@link deriveLegacyEmbeddedData} directly, so "which of two named decisions does this reader
 * make" stays a property a reviewer can check with grep.
 *
 * Two groups of callers need this rather than the stored rows:
 *
 * 1. **The editor.** Its working copy is cloned from the server survey at mount and never
 *    re-fetched, while the rows are only written on save — so an inlined `embeddedFields` is stale
 *    from the first card edit until the next save. Deriving is what makes a rename or a newly added
 *    field show up in the pickers, the logic builder, the calculate widget, the follow-up recipient
 *    list and the preview on the next render. Note this cannot be fixed by reshaping the working
 *    copy instead: it is compared against the server survey with a key-count-sensitive deep equal
 *    to gate the draft auto-save, the discard-changes dialog and the beforeunload prompt, and a
 *    save round-trip puts the server's shape back anyway.
 * 2. **Recall labelling** (`apps/web/lib/utils/recall.ts`). A recall token's label is authoring
 *    syntax: the picker writes `@label` into the text and the label resolver reads it back, so the
 *    two must agree on the same instant's definitions or the round-trip desyncs — a field added
 *    since the last save would render as a raw `#recall:…#` token, and a renamed one would stop
 *    matching. The same functions also label saved surveys for exports and summaries, where this is
 *    a no-op — a saved survey's rows and declarations agree element for element, because every write
 *    path that persists those columns calls `reconcileEmbeddedData` in the same transaction with the
 *    same payload it wrote them from (ENG-2412 moved that call onto the payload; before it, onto the
 *    row just written). There are exactly four: `updateSurveyInternal` and `createSurvey`
 *    (apps/web/lib/survey/service.ts), the copy flow (modules/survey/list/lib/survey.ts) and the v3
 *    patch (app/api/v3/surveys/patch.ts) — a `reconcileEmbeddedData(` grep is the audit, and a fifth
 *    write that skips it reintroduces the divergence. They can also diverge once a shared library definition can be renamed independently
 *    of the survey (ENG-1851), which is when the unified picker (ENG-1853) moves recall and the
 *    pickers onto the tables together.
 */
// Takes the same survey slice as {@link getSurveyEmbeddedFields}, not the narrower legacy one, so a
// caller holding a full survey can pass it and the "ignores the stored rows" contract is visible in
// the signature rather than enforced by which keys happen to be omitted at the call site.
export const getDeclaredEmbeddedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  deriveLegacyEmbeddedData(survey);

/** The computed (ex-variable) fields a survey declares right now. */
export const getDeclaredComputedFields = (survey: TEmbeddedFieldsSurvey): TLinkedEmbeddedField[] =>
  getDeclaredEmbeddedFields(survey).filter(({ field }) => field.source === "computed");

/** The storage keys of the ingested (ex-hidden) fields a survey declares right now. */
export const getDeclaredIngestedStorageKeys = (survey: TEmbeddedFieldsSurvey): string[] =>
  getDeclaredEmbeddedFields(survey)
    .filter(({ field }) => field.source === "ingested")
    .map(({ link }) => link.storageKey);
