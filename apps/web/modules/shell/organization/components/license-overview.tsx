import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import type {
  TEnterpriseLicenseFeatures,
  TLicenseStatus,
} from "@/modules/ee/license-check/types/enterprise-license";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Card } from "@/modules/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { getUsageMeter } from "../lib/usage-meter";
import { RecheckLicenseButton } from "./recheck-license-button";
import { TABLE_HEAD_CLASS, TableFrame } from "./section-heading";
import { UsageMeterRow } from "./usage-meter-row";

interface LicenseOverviewProps {
  status: TLicenseStatus;
  lastChecked: Date;
  /** Set while the license server is unreachable: when the grace period runs out. */
  gracePeriodEnd: Date | null;
  features: TEnterpriseLicenseFeatures | null;
  usage: { members: number; workspaces: number; workspaceLimit: number | null };
  /** Any workspace of the organization; the recheck action authorizes through it. `null` hides the button. */
  recheckWorkspaceId: string | null;
  trialRequestUrl: string;
  liteRequestUrl: string;
  locale: string;
  /** The organization reporting time zone. */
  timeZone: string;
}

type TPublicFeatureKey = Exclude<keyof TEnterpriseLicenseFeatures, "isMultiOrgEnabled">;

const isFeatureEnabled = (value: TEnterpriseLicenseFeatures[TPublicFeatureKey]): boolean =>
  typeof value === "boolean" ? value : value === null || value > 0;

export const LicenseOverview = async ({
  status,
  lastChecked,
  gracePeriodEnd,
  features,
  usage,
  recheckWorkspaceId,
  trialRequestUrl,
  liteRequestUrl,
  locale,
  timeZone,
}: Readonly<LicenseOverviewProps>) => {
  const t = await getTranslate();
  const hasLicense = status !== "no-license";

  const statusBadge = (() => {
    switch (status) {
      case "active":
        return <Badge type="success" size="normal" text={t("shell.organization.billing.license_active")} />;
      case "expired":
        return <Badge type="error" size="normal" text={t("shell.organization.billing.license_expired")} />;
      case "unreachable":
        return (
          <Badge type="warning" size="normal" text={t("shell.organization.billing.license_unreachable")} />
        );
      case "invalid_license":
        return <Badge type="error" size="normal" text={t("shell.organization.billing.license_invalid")} />;
      case "instance_mismatch":
        return <Badge type="error" size="normal" text={t("shell.organization.billing.license_mismatch")} />;
      default:
        return <Badge type="gray" size="normal" text={t("shell.organization.billing.license_none")} />;
    }
  })();

  // Spelled out as t() calls rather than a key table, so every label is reachable by the translation scan.
  const featureRows: { key: TPublicFeatureKey; label: string }[] = [
    { key: "removeBranding", label: t("workspace.settings.enterprise.hide_powered_by_formbricks") },
    { key: "whitelabel", label: t("workspace.settings.enterprise.whitelabel_email_follow_ups") },
    { key: "accessControl", label: t("workspace.settings.enterprise.teams_and_access_roles") },
    { key: "contacts", label: t("workspace.settings.enterprise.contacts_and_segments") },
    { key: "quotas", label: t("workspace.settings.enterprise.quota_management") },
    { key: "feedbackDirectories", label: t("workspace.settings.enterprise.feedback_directories") },
    { key: "dashboards", label: t("shell.organization.billing.feature_feedback_analytics") },
    { key: "auditLogs", label: t("workspace.settings.enterprise.audit_logs") },
    { key: "sso", label: t("workspace.settings.enterprise.oidc_sso") },
    { key: "saml", label: t("workspace.settings.enterprise.saml_sso") },
    { key: "spamProtection", label: t("workspace.settings.enterprise.spam_protection_recaptcha") },
    { key: "twoFactorAuth", label: t("workspace.settings.enterprise.two_factor_authentication") },
    { key: "workspaces", label: t("workspace.settings.enterprise.custom_workspace_count") },
    { key: "workflows", label: t("workspace.settings.enterprise.workflows") },
    { key: "dataRetention", label: t("workspace.settings.enterprise.data_retention") },
    { key: "creatives", label: t("workspace.settings.enterprise.creatives") },
  ];

  const workspacesMeter = getUsageMeter(usage.workspaces, usage.workspaceLimit);
  const formatCount = (value: number) => value.toLocaleString(locale);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5 p-6">
        <div className="max-w-[68ch]">
          <h2 className="text-base font-semibold text-slate-800">
            {t("shell.organization.billing.license_title")}
          </h2>
          <p className="mt-0.5 text-slate-600">{t("shell.organization.billing.license_description")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800">{t("common.enterprise_license")}</span>
              {statusBadge}
            </div>
            {hasLicense && (
              <span className="text-slate-500">
                {t("shell.organization.billing.license_checked", {
                  date: formatDateTimeForDisplay(lastChecked, locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone,
                  }),
                })}
              </span>
            )}
          </div>
          {hasLicense && recheckWorkspaceId && <RecheckLicenseButton workspaceId={recheckWorkspaceId} />}
          {!hasLicense && (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={trialRequestUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {t("common.request_trial_license")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={liteRequestUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {t("workspace.settings.enterprise.request_lite_license")}
                </a>
              </Button>
            </div>
          )}
        </div>

        {status === "unreachable" && gracePeriodEnd && (
          <Alert variant="warning" role="status">
            <AlertDescription>
              {t("workspace.settings.enterprise.license_unreachable_grace_period", {
                gracePeriodEnd: formatDateForDisplay(gracePeriodEnd, locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              })}
            </AlertDescription>
          </Alert>
        )}
        {status === "invalid_license" && (
          <Alert variant="error" role="status">
            <AlertDescription>
              {t("workspace.settings.enterprise.license_invalid_description")}
            </AlertDescription>
          </Alert>
        )}
        {status === "instance_mismatch" && (
          <Alert variant="error" role="status">
            <AlertDescription>
              {t("workspace.settings.enterprise.license_instance_mismatch_description")}
            </AlertDescription>
          </Alert>
        )}

        <p className="border-t border-slate-100 pt-4 text-slate-500">
          {t("shell.organization.billing.license_key_note")}
        </p>
      </Card>

      <Card className="flex flex-col gap-5 p-6">
        <h2 className="text-base font-semibold text-slate-800">
          {t("shell.organization.billing.usage_title")}
        </h2>
        <UsageMeterRow
          label={t("common.workspaces")}
          meter={workspacesMeter}
          value={
            workspacesMeter.limit === null
              ? t("shell.organization.billing.usage_no_limit", { current: formatCount(usage.workspaces) })
              : t("shell.organization.billing.usage_of_limit", {
                  current: formatCount(usage.workspaces),
                  limit: formatCount(workspacesMeter.limit),
                })
          }
        />
        <dl className="grid gap-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-slate-500">{t("common.members")}</dt>
            <dd className="text-lg font-semibold text-slate-800">{formatCount(usage.members)}</dd>
          </div>
        </dl>
      </Card>

      {features && (
        <TableFrame>
          <Table aria-label={t("shell.organization.billing.features_title")}>
            <TableHeader>
              <TableRow>
                <TableHead className={TABLE_HEAD_CLASS}>{t("shell.organization.billing.feature")}</TableHead>
                <TableHead className={TABLE_HEAD_CLASS}>{t("shell.organization.billing.access")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureRows.map(({ key, label }) => {
                const value = features[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="text-slate-800">{label}</TableCell>
                    <TableCell>
                      {key === "workspaces" ? (
                        <span className="text-slate-700">
                          {value === null || typeof value === "boolean"
                            ? t("workspace.settings.enterprise.license_features_table_unlimited")
                            : formatCount(value)}
                        </span>
                      ) : (
                        <Badge
                          type={isFeatureEnabled(value) ? "success" : "gray"}
                          size="normal"
                          text={
                            isFeatureEnabled(value)
                              ? t("shell.organization.billing.feature_included")
                              : t("shell.organization.billing.feature_not_included")
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </div>
  );
};
