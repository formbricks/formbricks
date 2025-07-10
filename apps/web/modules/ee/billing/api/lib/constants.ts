import { TFnType } from "@tolgee/react";

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
  mainFeatures: string[];
  href?: string;
};

export const getCloudPricingData = (t: TFnType): { plans: TPricingPlan[] } => {
  const freePlan: TPricingPlan = {
    id: "free",
    name: t("environments.settings.billing.free"),
    featured: false,
    description: t("environments.settings.billing.free_description"),
    price: { monthly: "$0", yearly: "$0" },
    mainFeatures: [
      t("environments.settings.billing.unlimited_surveys"),
      t("environments.settings.billing.1000_monthly_responses"),
      t("environments.settings.billing.2000_contacts"),
      t("environments.settings.billing.1_project"),
      t("environments.settings.billing.unlimited_team_members"),
      t("environments.settings.billing.link_surveys"),
      t("environments.settings.billing.website_surveys"),
      t("environments.settings.billing.app_surveys"),
      t("environments.settings.billing.ios_android_sdks"),
      t("environments.settings.billing.email_embedded_surveys"),
      t("environments.settings.billing.logic_jumps_hidden_fields_recurring_surveys"),
      t("environments.settings.billing.api_webhooks"),
      t("environments.settings.billing.all_integrations"),
      t("environments.settings.billing.hosted_in_frankfurt") + "  🇪🇺",
    ],
  };

  const startupPlan: TPricingPlan = {
    id: "startup",
    name: t("environments.settings.billing.startup"),
    featured: true,
    CTA: t("common.start_free_trial"),
    description: t("environments.settings.billing.startup_description"),
    price: { monthly: "$49", yearly: "$490" },
    mainFeatures: [
      t("environments.settings.billing.everything_in_free"),
      t("environments.settings.billing.5000_monthly_responses"),
      t("environments.settings.billing.7500_contacts"),
      t("environments.settings.billing.3_projects"),
      t("environments.settings.billing.remove_branding"),
      t("environments.settings.billing.email_follow_ups"),
      t("environments.settings.billing.attribute_based_targeting"),
    ],
  };

  const customPlan: TPricingPlan = {
    id: "enterprise",
    name: t("environments.settings.billing.custom"),
    featured: false,
    CTA: t("common.request_pricing"),
    description: t("environments.settings.billing.enterprise_description"),
    price: {
      monthly: t("environments.settings.billing.custom"),
      yearly: t("environments.settings.billing.custom"),
    },
    mainFeatures: [
      t("environments.settings.billing.everything_in_startup"),
      t("environments.settings.billing.custom_response_limit"),
      t("environments.settings.billing.custom_contacts_limit"),
      t("environments.settings.billing.custom_project_limit"),
      t("environments.settings.billing.team_access_roles"),
      t("environments.project.languages.multi_language_surveys"),
      t("environments.settings.enterprise.saml_sso"),
      t("environments.settings.billing.uptime_sla_99"),
      t("environments.settings.billing.premium_support_with_slas"),
    ],
    href: "https://app.formbricks.com/s/cm7k8esy20001jp030fh8a9o5?source=billingView&delivery=cloud",
  };

  return {
    plans: [freePlan, startupPlan, customPlan],
  };
};
