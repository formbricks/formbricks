import type { TFunction } from "i18next";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  CalendarDaysIcon,
  ClockIcon,
  FileDigitIcon,
  FileTextIcon,
  FileType2Icon,
  FlagIcon,
  GlobeIcon,
  LanguagesIcon,
  type LucideIcon,
  MegaphoneIcon,
  MonitorIcon,
  MousePointerClickIcon,
  ShieldIcon,
  SmartphoneIcon,
  TimerIcon,
  ToggleLeftIcon,
} from "lucide-react";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";

/**
 * The human-readable label for a reserved field (ENG-2540).
 *
 * **This is the one label for an auto-captured field, everywhere it is named.** It started out
 * serving the response table and the response card; ENG-1853 pointed the recall picker and the logic
 * operand pickers at it too, which is why it now lives under `modules/embedded-data` rather than
 * under `modules/analysis` — a reserved field is auto-captured Embedded Data, and the workspace
 * Embedded Data settings page reads the same list. Before that move the pickers derived their own
 * labels through `formatFieldNameToTitleCase` and rendered `Url`, `Os` and `Action` beside a
 * response table that said `URL`, `OS` and `Action` for the same field.
 *
 * **Every field either surface displays today has its own key, and so does the one filter-only
 * entry.** All twenty-one `display !== "none"` catalog entries are listed below, plus
 * `durationSeconds`, which no column shows but the response filter offers (ENG-1848), and
 * `language`, which no column shows but the mid-survey pickers offer. So `Page Path`,
 * `UTM Source` and `Duration (seconds)` are translated in every locale rather than rendered as
 * English derived from the catalog name — which is what the repo's i18n rule asks for, and what
 * shipping them derived would have quietly broken.
 *
 * `formatFieldNameToTitleCase` — the helper the pickers used to label with — stays as the
 * `default` arm, deliberately, as a **last resort rather than the rule**: ENG-1858's next batch of
 * catalog entries still surfaces on every surface with no edit here, reading in English until
 * someone adds its key. So a catalog addition is still free, just not yet localized; that is the
 * trade the ticket's "adding a catalog entry surfaces it in both places with no further change"
 * criterion buys, and it is the reason this is not a lookup keyed off a required per-entry field.
 *
 * A switch of literal `t("…")` calls rather than a name → key lookup map on purpose: `pnpm i18n`
 * scans for literal `t()` arguments to find unused keys, and a map would make every
 * `workspace.surveys.responses.*` key below read as dead and get deleted from thirty locale files.
 */
export const getReservedFieldLabel = (name: string, t: TFunction): string => {
  switch (name) {
    // The seven `primary` fields, all of which predate the catalog and keep their shipped copy.
    case "action":
      return t("common.action");
    case "browser":
      return t("workspace.surveys.responses.browser");
    case "country":
      return t("workspace.surveys.responses.country");
    // The catalog spells this `deviceType`; both surfaces have always shown `Device`.
    case "deviceType":
      return t("workspace.surveys.responses.device");
    case "os":
      return t("workspace.surveys.responses.os");
    case "source":
      return t("workspace.surveys.responses.source");
    case "url":
      return t("common.url");
    // The fourteen `secondary` fields. `ipAddress` is the only one with copy older than ENG-1841.
    case "ipAddress":
      return t("workspace.surveys.responses.ip_address");
    case "locale":
      return t("workspace.surveys.responses.locale");
    case "pagePath":
      return t("workspace.surveys.responses.page_path");
    case "pageReferrer":
      return t("workspace.surveys.responses.page_referrer");
    case "screenHeight":
      return t("workspace.surveys.responses.screen_height");
    case "screenWidth":
      return t("workspace.surveys.responses.screen_width");
    case "timezone":
      return t("workspace.surveys.responses.timezone");
    case "utmCampaign":
      return t("workspace.surveys.responses.utm_campaign");
    case "utmContent":
      return t("workspace.surveys.responses.utm_content");
    case "utmMedium":
      return t("workspace.surveys.responses.utm_medium");
    case "utmSource":
      return t("workspace.surveys.responses.utm_source");
    case "utmTerm":
      return t("workspace.surveys.responses.utm_term");
    case "viewportHeight":
      return t("workspace.surveys.responses.viewport_height");
    case "viewportWidth":
      return t("workspace.surveys.responses.viewport_width");
    // The two `display: "none"` entries a picker offers but no column ever shows: `durationSeconds`
    // to the response filter (ENG-1848/ENG-2894), and `language` — the only `availability: "both"`
    // entry — to the mid-survey recall and logic pickers (ENG-1853). Both reuse a key that already
    // exists rather than adding copy for a word already translated thirty times over.
    case "durationSeconds":
      return t("workspace.surveys.responses.duration_seconds");
    case "language":
      return t("common.language");
    default:
      return formatFieldNameToTitleCase(name);
  }
};
/**
 * Column and row icons, by catalog entry name. Sparse on purpose: an entry with no icon renders
 * without one rather than borrowing a misleading neighbour's, and the UTM family deliberately shares
 * one so a row of five reads as one group.
 */
export const RESERVED_FIELD_ICONS: Record<string, LucideIcon> = {
  action: MousePointerClickIcon,
  browser: GlobeIcon,
  country: FlagIcon,
  deviceType: SmartphoneIcon,
  // Not displayed by the table (display: "none") but offered by the response filter (ENG-1848).
  durationSeconds: TimerIcon,
  ipAddress: ShieldIcon,
  locale: LanguagesIcon,
  os: AirplayIcon,
  pagePath: FileTextIcon,
  pageReferrer: ArrowUpFromDotIcon,
  screenHeight: MonitorIcon,
  screenWidth: MonitorIcon,
  source: ArrowUpFromDotIcon,
  timezone: ClockIcon,
  url: GlobeIcon,
  utmCampaign: MegaphoneIcon,
  utmContent: MegaphoneIcon,
  utmMedium: MegaphoneIcon,
  utmSource: MegaphoneIcon,
  utmTerm: MegaphoneIcon,
  viewportHeight: MonitorIcon,
  viewportWidth: MonitorIcon,
};

/**
 * Which icon a **declared** Embedded Data field gets, by the kind of value it holds (ENG-1853).
 *
 * The group merge retired the icon's old job: with a Variables group and a Hidden Fields group,
 * `FileType2Icon` versus `EyeOffIcon` said which group the row was in, which the heading above it
 * said already. In one group the distinction worth drawing is what the value *is* — which is also
 * what decides the operators the next dropdown will offer, and whether the recall token will render
 * a date or a word.
 *
 * A map rather than a chain of ternaries so it stays exhaustive: adding a dataType is a compile
 * error here instead of a row that quietly renders with no icon. Auto-captured fields have their own
 * map ({@link RESERVED_FIELD_ICONS}), keyed by name, because there a `string` is sometimes a country
 * and sometimes a browser and the icon is worth more than the type would be.
 */
export const EMBEDDED_FIELD_ICON_BY_DATA_TYPE: Record<TEmbeddedDataType, LucideIcon> = {
  string: FileType2Icon,
  number: FileDigitIcon,
  boolean: ToggleLeftIcon,
  date: CalendarDaysIcon,
};

/** The icon an auto-captured field gets, falling back to the generic one for an entry with none. */
export const getReservedFieldIcon = (name: string): LucideIcon => RESERVED_FIELD_ICONS[name] ?? GlobeIcon;
