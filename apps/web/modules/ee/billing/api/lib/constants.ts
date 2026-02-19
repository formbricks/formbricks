import { TFunction } from "i18next";

export type TPricingPlan = {
  id: "hobby" | "pro" | "scale";
  name: string;
  featured: boolean;
  CTA?: string;
  description: string;
  price: {
    monthly: string;
    yearly: string;
  };
  mainFeatures: string[];
};

export const getCloudPricingData = (t: TFunction): { plans: TPricingPlan[] } => {
  // Keep legacy billing translation keys referenced until locale cleanup/migration is done.
  void [
    t("common.request_pricing"),
    t("environments.settings.billing.1000_monthly_responses"),
    t("environments.settings.billing.1_workspace"),
    t("environments.settings.billing.2000_contacts"),
    t("environments.settings.billing.3_workspaces"),
    t("environments.settings.billing.5000_monthly_responses"),
    t("environments.settings.billing.7500_contacts"),
    t("environments.settings.billing.api_webhooks"),
    t("environments.settings.billing.attribute_based_targeting"),
    t("environments.settings.billing.custom"),
    t("environments.settings.billing.custom_contacts_limit"),
    t("environments.settings.billing.custom_response_limit"),
    t("environments.settings.billing.custom_workspace_limit"),
    t("environments.settings.billing.email_embedded_surveys"),
    t("environments.settings.billing.email_follow_ups"),
    t("environments.settings.billing.enterprise_description"),
    t("environments.settings.billing.everything_in_free"),
    t("environments.settings.billing.everything_in_startup"),
    t("environments.settings.billing.free"),
    t("environments.settings.billing.free_description"),
    t("environments.settings.billing.hosted_in_frankfurt"),
    t("environments.settings.billing.ios_android_sdks"),
    t("environments.settings.billing.premium_support_with_slas"),
    t("environments.settings.billing.startup"),
    t("environments.settings.billing.startup_description"),
    t("environments.settings.billing.switch_plan"),
    t("environments.settings.billing.unlimited_surveys"),
    t("environments.settings.billing.unlimited_team_members"),
    t("environments.settings.billing.uptime_sla_99"),
    t("environments.settings.billing.website_surveys"),
  ];

  const hobbyPlan: TPricingPlan = {
    id: "hobby",
    name: "Hobby",
    featured: false,
    CTA: "Get started",
    description: "Start free",
    price: { monthly: "$0", yearly: "$0" },
    mainFeatures: [
      "1 Workspace",
      "250 Responses / month",
      t("environments.settings.billing.link_surveys"),
      t("environments.settings.billing.app_surveys"),
      t("environments.settings.billing.logic_jumps_hidden_fields_recurring_surveys"),
      "Hosted in Frankfurt \ud83c\uddea\ud83c\uddfa",
    ],
  };

  const proPlan: TPricingPlan = {
    id: "pro",
    name: "Pro",
    featured: true,
    CTA: t("common.start_free_trial"),
    description: "Most popular",
    price: { monthly: "$89", yearly: "$890" },
    mainFeatures: [
      "Everything in Hobby",
      "3 Workspaces",
      "2,000 Responses / month (dynamic overage)",
      t("environments.settings.billing.remove_branding"),
      "Respondent Identification",
      "Email Follow-ups",
      "Custom Webhooks",
      t("environments.settings.billing.all_integrations"),
    ],
  };

  const scalePlan: TPricingPlan = {
    id: "scale",
    name: "Scale",
    featured: false,
    CTA: t("common.start_free_trial"),
    description: "Advanced controls for scaling teams",
    price: { monthly: "$390", yearly: "$3,900" },
    mainFeatures: [
      "Everything in Pro",
      "5 Workspaces",
      "5,000 Responses / month (dynamic overage)",
      t("environments.settings.billing.team_access_roles"),
      "Full API Access",
      "Quota Management",
      "Two-Factor Auth",
      "Spam Protection (reCAPTCHA)",
      "SSO Enforcement",
      "Custom SSO",
      "Hosting in USA \ud83c\uddfa\ud83c\uddf8",
      "SOC-2 Verification",
    ],
  };

  return {
    plans: [hobbyPlan, proPlan, scalePlan],
  };
};
