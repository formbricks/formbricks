"use client";

import type { TFunction } from "i18next";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

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
      docsUrl: "https://formbricks.com/docs/xm-and-surveys/surveys/general-features/quota-management",
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
      docsUrl: "https://formbricks.com/docs/xm-and-surveys/surveys/general-features/spam-protection",
    },
    {
      key: "twoFactorAuth",
      labelKey: t("workspace.settings.enterprise.two_factor_authentication"),
      docsUrl: "https://formbricks.com/docs/xm-and-surveys/core-features/user-management/two-factor-auth",
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
  ];
};

interface EnterpriseLicenseFeaturesTableProps {
  features: TEnterpriseLicenseFeatures;
}

export const EnterpriseLicenseFeaturesTable = ({ features }: EnterpriseLicenseFeaturesTableProps) => {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("workspace.settings.enterprise.license_features_table_title")}
      description={t("workspace.settings.enterprise.license_features_table_description")}
      noPadding>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-white">
            <TableHead>{t("workspace.settings.enterprise.license_features_table_feature")}</TableHead>
            <TableHead>{t("workspace.settings.enterprise.license_features_table_access")}</TableHead>
            <TableHead>{t("workspace.settings.enterprise.license_features_table_value")}</TableHead>
            <TableHead>{t("common.documentation")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {getFeatureDefinitions(t).map((feature) => {
            const value = features[feature.key];
            const isEnabled = typeof value === "boolean" ? value : value === null || value > 0;
            let displayValue: number | string = "—";

            if (typeof value === "number") {
              displayValue = value;
            } else if (value === null) {
              displayValue = t("workspace.settings.enterprise.license_features_table_unlimited");
            }

            return (
              <TableRow key={feature.key} className="hover:bg-white">
                <TableCell className="font-medium text-slate-900">{t(feature.labelKey)}</TableCell>
                <TableCell>
                  <Badge
                    type={isEnabled ? "success" : "gray"}
                    size="normal"
                    text={
                      isEnabled
                        ? t("workspace.settings.enterprise.license_features_table_enabled")
                        : t("workspace.settings.enterprise.license_features_table_disabled")
                    }
                  />
                </TableCell>
                <TableCell className="text-slate-600">{displayValue}</TableCell>
                <TableCell>
                  <Link
                    href={feature.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
                    {t("common.read_docs")}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsCard>
  );
};
