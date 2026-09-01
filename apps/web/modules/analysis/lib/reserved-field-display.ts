import type { TFunction } from "i18next";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  ClockIcon,
  FileTextIcon,
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
} from "lucide-react";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";

/**
 * The human-readable label for a reserved field (ENG-2540).
 *
 * **Every field either surface displays today has its own key.** All twenty-one `display !== "none"`
 * catalog entries are listed below, so `Page Path`, `UTM Source` and `Timezone` are translated in
 * every locale rather than rendered as English derived from the catalog name — which is what the
 * repo's i18n rule asks for, and what shipping them derived would have quietly broken.
 *
 * `formatFieldNameToTitleCase` — the same helper the recall and logic pickers use — stays as the
 * `default` arm, deliberately, as a **last resort rather than the rule**: ENG-1858's next batch of
 * catalog entries still surfaces on both surfaces with no edit here, reading in English until
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
