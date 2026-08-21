import type { TFunction } from "i18next";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  ClockIcon,
  FileTextIcon,
  FlagIcon,
  GlobeIcon,
  type LucideIcon,
  MegaphoneIcon,
  MonitorIcon,
  MousePointerClickIcon,
  ShieldIcon,
  SmartphoneIcon,
} from "lucide-react";
import { formatFieldNameToTitleCase } from "@formbricks/types/safe-identifier";

/**
 * The human-readable label for a reserved field (ENG-2540).
 *
 * **An override layer, not a list of every field.** `formatFieldNameToTitleCase` — the same helper
 * the recall and logic pickers use — is the rule, and the `default` arm is what makes a catalog
 * addition free: ENG-1841's twelve fields, and ENG-1858's next batch, get a readable label with no
 * edit here and no new translation key. The eight cases exist only where deriving would visibly
 * regress shipped copy: `Url` for `URL`, `Ip Address` for `IP Address`, and `Device Type` where both
 * the response card and the response table have always said `Device`.
 *
 * A switch of literal `t("…")` calls rather than a name → key lookup map on purpose: `pnpm i18n`
 * scans for literal `t()` arguments to find unused keys, and a map would make all five
 * `workspace.surveys.responses.*` keys below read as dead and get deleted from thirty locale files.
 */
export const getReservedFieldLabel = (name: string, t: TFunction): string => {
  switch (name) {
    case "action":
      return t("common.action");
    case "browser":
      return t("workspace.surveys.responses.browser");
    case "country":
      return t("workspace.surveys.responses.country");
    // The catalog spells this `deviceType`; both surfaces have always shown `Device`.
    case "deviceType":
      return t("workspace.surveys.responses.device");
    case "ipAddress":
      return t("workspace.surveys.responses.ip_address");
    case "os":
      return t("workspace.surveys.responses.os");
    case "source":
      return t("workspace.surveys.responses.source");
    case "url":
      return t("common.url");
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
  ipAddress: ShieldIcon,
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
