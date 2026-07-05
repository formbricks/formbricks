import { TFunction } from "i18next";
import { TTemplateRole } from "@formbricks/types/templates";
import { TWorkspaceConfigChannel, TWorkspaceConfigIndustry } from "@formbricks/types/workspace";

export const getChannelMapping = (t: TFunction): { value: TWorkspaceConfigChannel; label: string }[] => [
  { value: "website", label: t("common.website_survey") },
  { value: "app", label: t("common.app_survey") },
  { value: "link", label: t("common.link_survey") },
];

export const getIndustryMapping = (t: TFunction): { value: TWorkspaceConfigIndustry; label: string }[] => [
  { value: "eCommerce", label: t("common.e_commerce") },
  { value: "saas", label: t("common.saas") },
  { value: "other", label: t("common.other") },
];

export const getRoleMapping = (t: TFunction): { value: TTemplateRole; label: string }[] => [
  { value: "productManager", label: t("common.product_manager") },
  { value: "marketing", label: t("common.marketing") },
  { value: "customerSuccess", label: t("common.customer_success") },
  { value: "peopleManager", label: t("common.people_manager") },
  { value: "sales", label: t("common.sales") },
];
