import type { TOrganizationStripeSubscriptionStatus } from "@formbricks/types/organizations";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import {
  type TCloudBillingDisplayContext,
  type TCloudBillingDisplayPlan,
} from "@/modules/ee/billing/lib/cloud-billing-display";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Card } from "@/modules/ui/components/card";
import { getUsageMeter } from "../lib/usage-meter";
import { ManageSubscriptionButton } from "./manage-subscription-button";
import { UsageMeterRow } from "./usage-meter-row";

interface CloudBillingProps {
  organizationId: string;
  billing: TCloudBillingDisplayContext;
  responseCount: number;
  workspaceCount: number;
  /** Owners, managers and the billing role; a plain member sees the plan and usage, nothing to change. */
  canManageBilling: boolean;
  locale: string;
}

const UTC_DATE = { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } as const;

export const CloudBilling = async ({
  organizationId,
  billing,
  responseCount,
  workspaceCount,
  canManageBilling,
  locale,
}: Readonly<CloudBillingProps>) => {
  const t = await getTranslate();
  const { limits, stripeCustomerId } = billing.billing;
  const status: TOrganizationStripeSubscriptionStatus | null = billing.currentSubscriptionStatus;

  const planLabels: Record<TCloudBillingDisplayPlan, string> = {
    hobby: t("workspace.settings.billing.plan_hobby"),
    pro: t("workspace.settings.billing.plan_pro"),
    scale: t("workspace.settings.billing.plan_scale"),
    custom: t("workspace.settings.billing.plan_custom"),
    unknown: t("workspace.settings.billing.plan_unknown"),
  };

  const renderStatusBadge = () => {
    switch (status) {
      case "active":
        return <Badge type="success" size="normal" text={t("shell.organization.billing.status_active")} />;
      case "trialing":
        return <Badge type="warning" size="normal" text={t("shell.organization.billing.status_trialing")} />;
      case "past_due":
      case "unpaid":
        return <Badge type="error" size="normal" text={t("shell.organization.billing.status_past_due")} />;
      case "paused":
        return <Badge type="gray" size="normal" text={t("shell.organization.billing.status_paused")} />;
      case "canceled":
      case "incomplete_expired":
        return <Badge type="gray" size="normal" text={t("shell.organization.billing.status_canceled")} />;
      case "incomplete":
        return (
          <Badge type="warning" size="normal" text={t("shell.organization.billing.status_incomplete")} />
        );
      default:
        return null;
    }
  };

  const responsesMeter = getUsageMeter(responseCount, limits.monthly.responses);
  const workspacesMeter = getUsageMeter(workspaceCount, limits.workspaces);
  const trialEnd = billing.billing.stripe?.trialEnd ? new Date(billing.billing.stripe.trialEnd) : null;
  const hasTrialEnd = status === "trialing" && trialEnd !== null && Number.isFinite(trialEnd.getTime());
  const { pendingChange } = billing;

  const formatCount = (value: number) => value.toLocaleString(locale);

  return (
    <div className="flex flex-col gap-4">
      {(status === "past_due" || status === "unpaid") && (
        <Alert variant="warning" role="status">
          <AlertTitle>{t("shell.organization.billing.past_due_title")}</AlertTitle>
          <AlertDescription>{t("shell.organization.billing.past_due_description")}</AlertDescription>
        </Alert>
      )}

      {pendingChange && (
        <Alert variant="info" role="status">
          <AlertDescription>
            {t("shell.organization.billing.pending_change", {
              plan: planLabels[pendingChange.targetPlan],
              date: formatDateForDisplay(new Date(pendingChange.effectiveAt), locale, UTC_DATE),
            })}
          </AlertDescription>
        </Alert>
      )}

      {canManageBilling && !stripeCustomerId && (
        <Alert variant="warning" role="status">
          <AlertTitle>{t("shell.organization.billing.setup_incomplete_title")}</AlertTitle>
          <AlertDescription>{t("shell.organization.billing.setup_incomplete_description")}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-6 p-6">
        <div className="max-w-[68ch]">
          <h2 className="text-base font-semibold text-slate-800">
            {t("shell.organization.billing.plan_title")}
          </h2>
          <p className="mt-0.5 text-slate-600">{t("shell.organization.billing.plan_description")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800">
                {t("shell.organization.billing.plan_name", { plan: planLabels[billing.currentCloudPlan] })}
              </span>
              {renderStatusBadge()}
              {billing.currentCloudPlan !== "hobby" && billing.currentBillingInterval && (
                <Badge
                  type="gray"
                  size="normal"
                  text={
                    billing.currentBillingInterval === "monthly"
                      ? t("shell.organization.billing.interval_monthly")
                      : t("shell.organization.billing.interval_yearly")
                  }
                />
              )}
            </div>
            {hasTrialEnd && trialEnd && (
              <span className="text-slate-500">
                {t("shell.organization.billing.trial_ends", {
                  date: formatDateForDisplay(trialEnd, locale, UTC_DATE),
                })}
              </span>
            )}
          </div>
          {canManageBilling && stripeCustomerId && (
            <ManageSubscriptionButton organizationId={organizationId} />
          )}
        </div>

        <div className="flex flex-col gap-5">
          <UsageMeterRow
            label={t("common.responses")}
            meter={responsesMeter}
            value={
              responsesMeter.limit === null
                ? t("shell.organization.billing.usage_no_limit", { current: formatCount(responseCount) })
                : t("shell.organization.billing.usage_this_month", {
                    current: formatCount(responseCount),
                    limit: formatCount(responsesMeter.limit),
                  })
            }
          />
          <UsageMeterRow
            label={t("common.workspaces")}
            meter={workspacesMeter}
            value={
              workspacesMeter.limit === null
                ? t("shell.organization.billing.usage_no_limit", { current: formatCount(workspaceCount) })
                : t("shell.organization.billing.usage_of_limit", {
                    current: formatCount(workspaceCount),
                    limit: formatCount(workspacesMeter.limit),
                  })
            }
          />
          <p className="text-slate-500">
            {t("shell.organization.billing.usage_cycle", {
              start: formatDateForDisplay(billing.usageCycleStart, locale, UTC_DATE),
              end: formatDateForDisplay(billing.usageCycleEnd, locale, UTC_DATE),
            })}
          </p>
        </div>

        {canManageBilling && stripeCustomerId && (
          <p className="border-t border-slate-100 pt-4 text-slate-500">
            {t("shell.organization.billing.portal_note")}
          </p>
        )}
      </Card>
    </div>
  );
};
