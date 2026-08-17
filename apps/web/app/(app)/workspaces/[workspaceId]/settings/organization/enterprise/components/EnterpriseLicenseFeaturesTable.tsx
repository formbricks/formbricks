"use client";

import type { TFunction } from "i18next";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { Badge } from "@/modules/ui/components/badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";

type TPublicLicenseFeatureKey = Exclude<keyof TEnterpriseLicenseFeatures, "isMultiOrgEnabled">;

type TFeatureDefinition = {
  key: TPublicLicenseFeatureKey;
  labelKey: string;
  docsUrl: string;
};

const getFeatureDefinitions = (t: TFunction): TFeatureDefinition[] => {
  return [
    {
      key: "removeBranding",
      labelKey: t("workspace.settings.enterprise.hide_powered_by_formbricks"),
      docsUrl:
        "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/hide-powered-by-formbricks",
    },
    {
      key: "whitelabel",
      labelKey: t("workspace.settings.enterprise.whitelabel_email_follow_ups"),
      docsUrl:
        "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/whitelabel-email-follow-ups",
    },
    {
      key: "accessControl",
      labelKey: t("workspace.settings.enterprise.teams_and_access_roles"),
      docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/team-access",
    },
    {
      key: "contacts",
      labelKey: t("workspace.settings.enterprise.contacts_and_segments"),
      docsUrl:
        "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/contact-management-segments",
    },
    {
      key: "quotas",
      labelKey: t("workspace.settings.enterprise.quota_management"),
      docsUrl: "https://formbricks.com/docs/surveys/general-features/quota-management",
    },
    {
      key: "feedbackDirectories",
      labelKey: t("workspace.settings.enterprise.feedback_directories"),
      docsUrl: "https://formbricks.com/docs/unify-feedback/feedback-directories",
    },
    {
      key: "dashboards",
      labelKey: t("workspace.settings.enterprise.insights_dashboards"),
      docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/dashboards",
    },
    {
      key: "auditLogs",
      labelKey: t("workspace.settings.enterprise.audit_logs"),
      docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/audit-logging",
    },
    {
      key: "sso",
      labelKey: t("workspace.settings.enterprise.oidc_sso"),
      docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/oidc-sso",
    },
    {
      key: "saml",
      labelKey: t("workspace.settings.enterprise.saml_sso"),
      docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/saml-sso",
    },
    {
      key: "spamProtection",
      labelKey: t("workspace.settings.enterprise.spam_protection_recaptcha"),
      docsUrl: "https://formbricks.com/docs/surveys/general-features/spam-protection",
    },
    {
      key: "twoFactorAuth",
      labelKey: t("workspace.settings.enterprise.two_factor_authentication"),
      docsUrl: "https://formbricks.com/docs/platform/features/user-management/two-factor-auth",
    },
    {
      key: "workspaces",
      labelKey: t("workspace.settings.enterprise.custom_workspace_count"),
      docsUrl: "https://formbricks.com/docs/self-hosting/advanced/license#what-features-are-free",
    },
    {
      key: "aiSmartTools",
      labelKey: t("workspace.settings.general.ai_smart_tools_enabled"),
      docsUrl: "https://formbricks.com/docs/self-hosting/configuration/ai",
    },
    {
      key: "workflows",
      labelKey: t("workspace.settings.enterprise.workflows"),
      docsUrl: "https://formbricks.com/docs/workflows/overview",
    },
  ];
};

interface EnterpriseLicenseFeaturesTableProps {
  features: TEnterpriseLicenseFeatures;
}

/** A feature is on when the flag is true, or when its limit is unlimited (`null`) or greater than zero. */
const isFeatureEnabled = (value: TEnterpriseLicenseFeatures[TPublicLicenseFeatureKey]): boolean =>
  typeof value === "boolean" ? value : value === null || value > 0;

const getFeatureValueLabel = (
  value: TEnterpriseLicenseFeatures[TPublicLicenseFeatureKey],
  t: TFunction
): number | string => {
  if (typeof value === "number") return value;
  if (value === null) return t("workspace.settings.enterprise.license_features_table_unlimited");
  return "—";
};

const getLicenseFeatureColumns = (
  t: TFunction,
  features: TEnterpriseLicenseFeatures
): TSettingsTableColumn<TFeatureDefinition>[] => [
  {
    id: "feature",
    header: t("workspace.settings.enterprise.license_features_table_feature"),
    headerClassName: "w-[40%]",
    cellClassName: "font-medium text-slate-900",
    cell: (feature) => t(feature.labelKey),
  },
  {
    id: "access",
    header: t("workspace.settings.enterprise.license_features_table_access"),
    headerClassName: "w-[20%]",
    cell: (feature) => {
      const isEnabled = isFeatureEnabled(features[feature.key]);

      return (
        <Badge
          type={isEnabled ? "success" : "gray"}
          size="normal"
          text={
            isEnabled
              ? t("workspace.settings.enterprise.license_features_table_enabled")
              : t("workspace.settings.enterprise.license_features_table_disabled")
          }
        />
      );
    },
  },
  {
    id: "value",
    header: t("workspace.settings.enterprise.license_features_table_value"),
    headerClassName: "w-[20%]",
    cellClassName: "text-slate-600",
    cell: (feature) => getFeatureValueLabel(features[feature.key], t),
  },
  {
    id: "documentation",
    header: t("common.documentation"),
    headerClassName: "w-[20%]",
    cell: (feature) => (
      <Link
        href={feature.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
        {t("common.read_docs")}
      </Link>
    ),
  },
];

export const EnterpriseLicenseFeaturesTable = ({
  features,
}: Readonly<EnterpriseLicenseFeaturesTableProps>) => {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("workspace.settings.enterprise.license_features_table_title")}
      description={t("workspace.settings.enterprise.license_features_table_description")}
      bodyVariant="flush">
      <SettingsTable
        columns={getLicenseFeatureColumns(t, features)}
        rows={getFeatureDefinitions(t)}
        getRowId={(feature) => feature.key}
        // Unreachable: the feature list is a compile-time constant, never empty.
        emptyMessage={t("common.no_results")}
      />
    </SettingsCard>
  );
};
