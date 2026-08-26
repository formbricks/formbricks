import { TFunction } from "i18next";
import {
  RESERVED_FIELD_CATALOG,
  type TDisplayableReservedField,
  type TReservedFieldDisplay,
  listDisplayableReservedFields,
} from "@formbricks/types/embedded-data-resolver";
import { TResponse } from "@formbricks/types/responses";
import { RESERVED_FIELD_ICONS, getReservedFieldLabel } from "@/modules/analysis/lib/reserved-field-display";

export const getAddressFieldLabel = (field: string, t: TFunction) => {
  switch (field) {
    case "addressLine1":
      return t("workspace.surveys.responses.address_line_1");
    case "addressLine2":
      return t("workspace.surveys.responses.address_line_2");
    case "city":
      return t("workspace.surveys.responses.city");
    case "state":
      return t("workspace.surveys.responses.state_region");
    case "zip":
      return t("workspace.surveys.responses.zip_post_code");
    case "country":
      return t("workspace.surveys.responses.country");
    default:
      break;
  }
};

export const getContactInfoFieldLabel = (field: string, t: TFunction) => {
  switch (field) {
    case "firstName":
      return t("workspace.surveys.responses.first_name");
    case "lastName":
      return t("workspace.surveys.responses.last_name");
    case "email":
      return t("workspace.surveys.responses.email");
    case "phone":
      return t("workspace.surveys.responses.phone");
    case "company":
      return t("workspace.surveys.responses.company");
    default:
      break;
  }
};

/**
 * The reserved fields the response table offers a column for, read from the catalog rather than a
 * local list (ENG-2540).
 *
 * `display: "none"` is excluded because the table already has fixed columns for the response's own
 * identity and timing (`responseId`, `createdAt`, `status`, `language`) — a second, differently
 * named column for the same fact is worse than none.
 *
 * This replaces `METADATA_FIELDS` and its hand-written `getMetadataValue` switch, which held six
 * names — no `ipAddress`, and `device` where the catalog says `deviceType` — and had to be edited
 * alongside the catalog and the response card every time ENG-1841-style capture landed. All twelve
 * ENG-1841 fields were missing from it.
 */
export const RESERVED_COLUMN_ENTRIES = RESERVED_FIELD_CATALOG.filter((entry) => entry.display !== "none");

/** Prefix for a reserved column's TanStack id. Unchanged, so persisted column state still matches. */
export const METADATA_COLUMN_PREFIX = "METADATA_";

/**
 * Catalog names whose column id must stay at the spelling already persisted in authors' browsers.
 *
 * The id is a **storage key**: it is what `${survey.id}-columnOrder` and `-columnVisibility` hold in
 * localStorage, so changing it silently discards that author's choice for the column. The catalog
 * calls the field `deviceType`; the table column has always been `METADATA_device`. Following the
 * catalog would have dropped the saved id on reconciliation — and because a `primary` column is left
 * unseeded (absent means visible in TanStack), an author who had *hidden* Device would have found it
 * back on after upgrading.
 *
 * Deliberately a map of exceptions rather than a rename: nothing else in the catalog diverges, and a
 * future entry gets its name as its id with no edit here.
 */
const PERSISTED_RESERVED_COLUMN_NAMES: Record<string, string> = {
  deviceType: "device",
};

/** The column id for a reserved field — its persisted spelling, which is not always its catalog name. */
export const reservedColumnId = (name: string): string =>
  `${METADATA_COLUMN_PREFIX}${PERSISTED_RESERVED_COLUMN_NAMES[name] ?? name}`;

/**
 * Which reserved columns start visible for an author who has never touched this table's settings.
 *
 * `primary` only — exactly the fields the table already showed, so the default view is unchanged.
 * The `secondary` ones exist as columns and appear in the settings modal, but unchecked: a survey's
 * table must not silently grow thirteen columns, several of which are empty for every response
 * collected before ENG-1841.
 */
export const isReservedColumnVisibleByDefault = (display: TReservedFieldDisplay): boolean =>
  display === "primary";

/** The label a reserved column's header shows: the product's own wording, or one derived from the name. */
export const getReservedColumnLabel = (name: string, t: TFunction): string => getReservedFieldLabel(name, t);

/** The icon a reserved column's header shows, or `undefined` when the field has none. */
export const getReservedColumnIcon = (name: string) => RESERVED_FIELD_ICONS[name];

/**
 * Every reserved value a response carries, keyed by column id — one pass over the catalog per row
 * rather than a switch consulted once per column.
 */
export const getReservedColumnValues = (response: TResponse): Record<string, string> => {
  const fields: TDisplayableReservedField[] = [
    ...listDisplayableReservedFields(RESERVED_FIELD_CATALOG, response, "primary"),
    ...listDisplayableReservedFields(RESERVED_FIELD_CATALOG, response, "secondary"),
  ];

  return Object.fromEntries(fields.map(({ entry, value }) => [reservedColumnId(entry.name), value]));
};
