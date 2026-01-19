import { TFunction } from "i18next";

export type TUsageLimit = {
  label: string;
  value: string;
  overage?: boolean;
};

export type TPricingPlan = {
  id: string;
  name: string;
  featured: boolean;
  CTA?: string;
  description: string;
  price: {
    monthly: string;
    yearly: string;
  };
  usageLimits: TUsageLimit[];
  features: string[];
  addons?: string[];
  href?: string;
};

export const getCloudPricingData = (t: TFunction): { plans: TPricingPlan[] } => {
  const hobbyPlan: TPricingPlan = {
    id: "free",
    name: "Hobby",
    featured: false,
    description: "Unlimited Surveys, Team Members, and more.",
    price: { monthly: "Start free", yearly: "Start free" },
    usageLimits: [
      { label: "Workspaces", value: "1" },
      { label: "Responses per month", value: "250" },
    ],
    features: [
      "Link-based Surveys",
      "In-product Surveys",
      "All Question Types",
      "Multi-language Surveys incl. RTL",
      "Conditional Logic",
      "Hidden Fields",
      "Partial Responses",
      "Recall Information",
      "Multi-media Backgrounds",
      "File Uploads",
      "Single-use Links",
      "Hosted in Frankfurt 🇪🇺",
    ],
  };

  const proPlan: TPricingPlan = {
    id: "pro",
    name: "Pro",
    featured: true,
    CTA: t("common.start_free_trial"),
    description: "Everything in Free with additional features.",
    price: { monthly: "$89", yearly: "$74" },
    usageLimits: [
      { label: "Workspaces", value: "3" },
      { label: "Responses per month", value: "2,000", overage: true },
      { label: "Identified Contacts per month", value: "5,000", overage: true },
    ],
    features: [
      "Everything in Free",
      "Unlimited Seats",
      "Hide Formbricks Branding",
      "Respondent Identification",
      "Contact & Segment Management",
      "Attribute-based Segmentation",
      "iOS & Android SDKs",
      "Email Follow-ups",
      "Custom Webhooks",
      "All Integrations",
    ],
  };

  const scalePlan: TPricingPlan = {
    id: "scale",
    name: "Scale",
    featured: false,
    CTA: t("common.start_free_trial"),
    description: "Advanced features for scaling your business.",
    price: { monthly: "$390", yearly: "$325" },
    usageLimits: [
      { label: "Workspaces", value: "5" },
      { label: "Responses per month", value: "5,000", overage: true },
      { label: "Identified Contacts per month", value: "10,000", overage: true },
    ],
    features: [
      "Everything in Pro",
      "Teams & Access Roles",
      "Full API Access",
      "Quota Management",
      "Two-Factor Auth",
      "Spam Protection (ReCaptcha)",
    ],
    addons: ["SSO Enforcement", "Custom SSO", "Hosting in USA 🇺🇸", "SOC-2 Verification"],
  };

  return {
    plans: [hobbyPlan, proPlan, scalePlan],
  };
};
