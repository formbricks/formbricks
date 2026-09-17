import { type TFunction } from "i18next";
import { type TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { RESERVED_FIELD_CATALOG, type TReservedFieldPrivacy } from "@formbricks/types/embedded-data-resolver";
import { getReservedFieldLabel } from "@/modules/embedded-data/lib/field-display";

/**
 * The read-only "Auto-captured fields" table, projected from `RESERVED_FIELD_CATALOG`.
 *
 * A projection rather than a list, because the catalog is the one place that decides what is
 * captured, when it can be read and what the Anonymize toggle does to it — the mistake this avoids
 * is the one ENG-2540 already paid for, where the response card and the response table each held
 * their own copy of the list and ENG-1841's twelve new fields reached neither.
 */

/**
 * When a field can be referenced in logic and recall, derived from the catalog's `availability`.
 *
 * `afterSubmit` is the honest reading of `server`: the value only exists once the request reaches
 * the API (a geo-IP country, a parsed user agent), so a running survey cannot recall it — but every
 * server-side reader, from filters to exports, can.
 */
export type TAutoCapturedAvailability = "always" | "afterSubmit";

export interface TAutoCapturedField {
  /** The catalog name — what logic, recall and exports address the field by. */
  name: string;
  /**
   * The translated label, from the same helper the field pickers use (ENG-1853) — so this table and
   * a logic operand call the field the same thing, acronyms included (`URL`, not `Url`).
   */
  label: string;
  dataType: TEmbeddedDataType;
  availability: TAutoCapturedAvailability;
  privacy: TReservedFieldPrivacy;
}

/**
 * Every auto-captured field a human-facing surface lists, in catalog order.
 *
 * `display: "none"` entries are dropped: the response's own identity and timing (`responseId`,
 * `startedAt`, `finished`, …) are rendered by the surfaces that own them and are not fields an
 * author reads as data.
 */
export const getAutoCapturedFields = (t: TFunction): TAutoCapturedField[] =>
  RESERVED_FIELD_CATALOG.filter((entry) => entry.display !== "none").map((entry) => ({
    name: entry.name,
    label: getReservedFieldLabel(entry.name, t),
    dataType: entry.dataType,
    availability: entry.availability === "server" ? "afterSubmit" : "always",
    privacy: entry.privacy,
  }));
