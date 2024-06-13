import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";

export const getCustomHeadline = (channel: TProductConfigChannel, industry: TProductConfigIndustry) => {
  const combinations = {
    "website+eCommerce": "Web shop",
    "website+saas": "Landing page",
    "app+eCommerce": "Shopping app",
    "app+saas": "SaaS app",
  };
  return combinations[`${channel}+${industry}`] || "App";
};
