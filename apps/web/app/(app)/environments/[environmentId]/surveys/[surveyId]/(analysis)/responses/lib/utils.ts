import { TFnType } from "@tolgee/react";
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

export const getAddressFieldLabel = (field: string, t: TFnType) => {
  switch (field) {
    case "addressLine1":
      return t("environments.surveys.responses.address_line_1");
    case "addressLine2":
      return t("environments.surveys.responses.address_line_2");
    case "city":
      return t("environments.surveys.responses.city");
    case "state":
      return t("environments.surveys.responses.state_region");
    case "zip":
      return t("environments.surveys.responses.zip_post_code");
    case "country":
      return t("environments.surveys.responses.country");
    default:
      break;
  }
};

export const getContactInfoFieldLabel = (field: string, t: TFnType) => {
  switch (field) {
    case "firstName":
      return t("environments.surveys.responses.first_name");
    case "lastName":
      return t("environments.surveys.responses.last_name");
    case "email":
      return t("environments.surveys.responses.email");
    case "phone":
      return t("environments.surveys.responses.phone");
    case "company":
      return t("environments.surveys.responses.company");
    default:
      break;
  }
};

export const getMetadataFieldLabel = (label: string, t: TFnType) => {
  switch (label) {
    case "action":
      return t("common.action");
    case "country":
      return t("environments.surveys.responses.country");
    case "os":
      return t("environments.surveys.responses.os");
    case "device":
      return t("environments.surveys.responses.device");
    case "browser":
      return t("environments.surveys.responses.browser");
    case "url":
      return t("common.url");
    case "source":
      return t("environments.surveys.responses.source");
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

export const getMetadataValue = (meta: TResponseMeta, label: string) => {
  if (userAgentFields.includes(label)) {
    return meta.userAgent?.[label];
  }
  return meta[label];
};
