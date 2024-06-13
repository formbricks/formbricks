export const getCustomHeadline = (channel: string, industry: string) => {
  const combinations = {
    "website+eCommerce": "Web shop",
    "website+saas": "Landing page",
    "app+eCommerce": "Shopping app",
    "app+saas": "SaaS app",
  };
  return combinations[`${channel}+${industry}`] || "App";
};
