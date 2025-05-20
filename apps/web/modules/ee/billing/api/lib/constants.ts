import { TFnType } from "@tolgee/react";

export const getCloudPricingData = (t: TFnType) => {
  return {
    plans: [
      {
        name: t("environments.settings.billing.free"),
        id: "free",
        featured: false,
        description: t("environments.settings.billing.free_description"),
        price: { monthly: "$0", yearly: "$0" },
        mainFeatures: [
          t("environments.settings.billing.unlimited_surveys"),
          t("environments.settings.billing.1000_monthly_responses"),
          t("environments.settings.billing.2000_contacts"),
          t("environments.settings.billing.3_projects"),
          t("environments.settings.billing.unlimited_team_members"),
          t("environments.settings.billing.link_surveys"),
          t("environments.settings.billing.website_surveys"),
          t("environments.settings.billing.app_surveys"),
          t("environments.settings.billing.ios_android_sdks"),
          t("environments.settings.billing.unlimited_apps_websites"),
          t("environments.settings.billing.email_embedded_surveys"),
          t("environments.settings.billing.logic_jumps_hidden_fields_recurring_surveys"),
          t("environments.settings.billing.api_webhooks"),
          t("environments.settings.billing.all_integrations"),
          t("environments.settings.billing.hosted_in_frankfurt") + "  🇪🇺",
        ],
        href: "https://app.formbricks.com/auth/signup?plan=free",
      },
      {
        name: t("environments.settings.billing.startup"),
        id: "startup",
        featured: true,
        description: t("environments.settings.billing.startup_description"),
        price: { monthly: "$49", yearly: "$490 " },
        mainFeatures: [
          t("environments.settings.billing.everything_in_free"),
          t("environments.settings.billing.5000_monthly_responses"),
          t("environments.settings.billing.7500_contacts"),
          t("environments.settings.billing.3_projects"),
          t("environments.settings.billing.remove_branding"),
          t("environments.settings.billing.email_follow_ups"),
          t("environments.settings.billing.attribute_based_targeting"),
        ],
        href: "https://app.formbricks.com/auth/signup?plan=startup",
      },
      {
        name: t("environments.settings.billing.scale_and_enterprise"),
        id: "enterprise",
        featured: false,
        description: t("environments.settings.billing.scale_and_enterprise_description"),
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
        href: "https://cal.com/johannes/enterprise-cloud",
      },
    ],
  };
};
