import { TFunction } from "i18next";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";

export const getChannelMapping = (t: TFunction): { value: TProjectConfigChannel; label: string }[] => [
  { value: "website", label: t("common.website_survey") },
  { value: "app", label: t("common.app_survey") },
  { value: "link", label: t("common.link_survey") },
];

export const getIndustryMapping = (t: TFunction): { value: TProjectConfigIndustry; label: string }[] => [
  { value: "eCommerce", label: t("common.e_commerce") },
  { value: "saas", label: t("common.saas") },
  { value: "other", label: t("common.other") },
];

export const getRoleMapping = (t: TFunction): { value: TTemplateRole; label: string }[] => [
  { value: "productManager", label: t("common.product_manager") },
  { value: "customerSuccess", label: t("common.customer_success") },
  { value: "marketing", label: t("common.marketing") },
  { value: "sales", label: t("common.sales") },
  { value: "peopleManager", label: t("common.people_manager") },
];
