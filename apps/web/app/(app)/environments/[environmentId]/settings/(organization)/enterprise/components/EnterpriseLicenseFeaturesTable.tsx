"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { TEnterpriseLicenseFeatures } from "@/modules/ee/license-check/types/enterprise-license";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { SettingsCard } from "../../../components/SettingsCard";

type TPublicLicenseFeatureKey = Exclude<keyof TEnterpriseLicenseFeatures, "isMultiOrgEnabled" | "ai">;

type TFeatureDefinition = {
  key: TPublicLicenseFeatureKey;
  labelKey: string;
  docsUrl: string;
};

const featureDefinitions: TFeatureDefinition[] = [
  {
    key: "contacts",
    labelKey: "environments.settings.enterprise.license_feature_contacts",
    docsUrl:
      "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/contact-management-segments",
  },
  {
    key: "projects",
    labelKey: "environments.settings.enterprise.license_feature_projects",
    docsUrl: "https://formbricks.com/docs/self-hosting/advanced/license",
  },
  {
    key: "whitelabel",
    labelKey: "environments.settings.enterprise.license_feature_whitelabel",
    docsUrl:
      "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/whitelabel-email-follow-ups",
  },
  {
    key: "removeBranding",
    labelKey: "environments.settings.enterprise.license_feature_remove_branding",
    docsUrl:
      "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/hide-powered-by-formbricks",
  },
  {
    key: "twoFactorAuth",
    labelKey: "environments.settings.enterprise.license_feature_two_factor_auth",
    docsUrl: "https://formbricks.com/docs/xm-and-surveys/core-features/user-management/two-factor-auth",
  },
  {
    key: "sso",
    labelKey: "environments.settings.enterprise.license_feature_sso",
    docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/oidc-sso",
  },
  {
    key: "saml",
    labelKey: "environments.settings.enterprise.license_feature_saml",
    docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/saml-sso",
  },
  {
    key: "spamProtection",
    labelKey: "environments.settings.enterprise.license_feature_spam_protection",
    docsUrl: "https://formbricks.com/docs/xm-and-surveys/surveys/general-features/spam-protection",
  },
  {
    key: "auditLogs",
    labelKey: "environments.settings.enterprise.license_feature_audit_logs",
    docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/audit-logging",
  },
  {
    key: "accessControl",
    labelKey: "environments.settings.enterprise.license_feature_access_control",
    docsUrl: "https://formbricks.com/docs/self-hosting/advanced/enterprise-features/team-access",
  },
  {
    key: "quotas",
    labelKey: "environments.settings.enterprise.license_feature_quotas",
    docsUrl: "https://formbricks.com/docs/xm-and-surveys/surveys/general-features/quota-management",
  },
];

interface EnterpriseLicenseFeaturesTableProps {
  features: TEnterpriseLicenseFeatures;
}

export const EnterpriseLicenseFeaturesTable = ({ features }: EnterpriseLicenseFeaturesTableProps) => {
  const { t } = useTranslation();

  return (
    <SettingsCard
      title={t("environments.settings.enterprise.license_features_table_title")}
      description={t("environments.settings.enterprise.license_features_table_description")}
      noPadding>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-white">
            <TableHead>{t("environments.settings.enterprise.license_features_table_feature")}</TableHead>
            <TableHead>{t("environments.settings.enterprise.license_features_table_access")}</TableHead>
            <TableHead>{t("environments.settings.enterprise.license_features_table_value")}</TableHead>
            <TableHead>{t("common.documentation")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {featureDefinitions.map((feature) => {
            const value = features[feature.key];
            const isEnabled = typeof value === "boolean" ? value : value === null || value > 0;
            let displayValue: number | string = "—";

            if (typeof value === "number") {
              displayValue = value;
            } else if (value === null) {
              displayValue = t("environments.settings.enterprise.license_features_table_unlimited");
            }

            return (
              <TableRow key={feature.key} className="hover:bg-white">
                <TableCell className="font-medium text-slate-900">{t(feature.labelKey)}</TableCell>
                <TableCell>
                  <Badge
                    type={isEnabled ? "success" : "gray"}
                    size="normal"
                    text={t(
                      isEnabled
                        ? "environments.settings.enterprise.license_features_table_enabled"
                        : "environments.settings.enterprise.license_features_table_disabled"
                    )}
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
