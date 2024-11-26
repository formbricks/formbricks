import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";

export const getCustomHeadline = (channel: TProductConfigChannel, industry: TProductConfigIndustry) => {
  const combinations = {
    "website+eCommerce": "web shop",
    "website+saas": "landing page",
    "website+other": "website",
    "app+eCommerce": "shopping app",
    "app+saas": "SaaS app",
    "app+other": "app",
  };
  return combinations[`${channel}+${industry}`] || "product";
};
