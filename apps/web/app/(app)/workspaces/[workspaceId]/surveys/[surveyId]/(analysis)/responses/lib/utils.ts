import { TFunction } from "i18next";
import { capitalize } from "lodash";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  FlagIcon,
  GlobeIcon,
  MousePointerClickIcon,
  SmartphoneIcon,
} from "lucide-react";
import { TResponseMeta } from "@formbricks/types/responses";

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

export const getMetadataFieldLabel = (label: string, t: TFunction) => {
  switch (label) {
    case "action":
      return t("common.action");
    case "country":
      return t("workspace.surveys.responses.country");
    case "os":
      return t("workspace.surveys.responses.os");
    case "device":
      return t("workspace.surveys.responses.device");
    case "browser":
      return t("workspace.surveys.responses.browser");
    case "url":
      return t("common.url");
    case "source":
      return t("workspace.surveys.responses.source");
    default:
      return capitalize(label);
  }
};

export const COLUMNS_ICON_MAP = {
  action: MousePointerClickIcon,
  country: FlagIcon,
  browser: GlobeIcon,
  os: AirplayIcon,
  device: SmartphoneIcon,
  source: ArrowUpFromDotIcon,
  url: GlobeIcon,
};

const userAgentFields = ["browser", "os", "device"];
export const METADATA_FIELDS = ["action", "country", ...userAgentFields, "source", "url"];

export const getMetadataValue = (
  meta: TResponseMeta,
  label: (typeof METADATA_FIELDS)[number]
): string | undefined => {
  switch (label) {
    case "browser":
      return meta.userAgent?.browser;
    case "os":
      return meta.userAgent?.os;
    case "device":
      return meta.userAgent?.device;
    case "action":
      return meta.action;
    case "country":
      return meta.country;
    case "source":
      return meta.source;
    case "url":
      return meta.url;
  }
};
