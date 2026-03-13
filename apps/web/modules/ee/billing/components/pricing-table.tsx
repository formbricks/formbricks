"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { createElement, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganization, TOrganizationStripeSubscriptionStatus } from "@formbricks/types/organizations";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  createPricingTableCustomerSessionAction,
  createTrialPaymentCheckoutAction,
  isSubscriptionCancelledAction,
  manageSubscriptionAction,
  retryStripeSetupAction,
} from "../actions";
import { TrialAlert } from "./trial-alert";
import { UsageCard } from "./usage-card";

const STRIPE_SUPPORTED_LOCALES = new Set([
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "en-GB",
  "es",
  "es-419",
  "et",
  "fi",
  "fil",
  "fr",
  "fr-CA",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "ms",
  "mt",
  "nb",
  "nl",
  "pl",
  "pt",
  "pt-BR",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "th",
  "tr",
  "vi",
  "zh",
  "zh-HK",
  "zh-TW",
]);

const getStripeLocaleOverride = (locale?: string): string | undefined => {
  if (!locale) return undefined;

  const normalizedLocale = locale.trim();
  if (STRIPE_SUPPORTED_LOCALES.has(normalizedLocale)) {
    return normalizedLocale;
  }

  const baseLocale = normalizedLocale.split("-")[0];
  if (STRIPE_SUPPORTED_LOCALES.has(baseLocale)) {
    return baseLocale;
  }

  return undefined;
};

const BILLING_CONFIRMATION_ENVIRONMENT_ID_KEY = "billingConfirmationEnvironmentId";

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  responseCount: number;
  projectCount: number;
  usageCycleStart: Date;
  usageCycleEnd: Date;
  hasBillingRights: boolean;
  currentCloudPlan: "hobby" | "pro" | "scale" | "custom" | "unknown";
  currentSubscriptionStatus: TOrganizationStripeSubscriptionStatus | null;
  stripePublishableKey: string | null;
  stripePricingTableId: string | null;
  isStripeSetupIncomplete: boolean;
  trialDaysRemaining: number | null;
}

const getCurrentCloudPlanLabel = (
  plan: "hobby" | "pro" | "scale" | "custom" | "unknown",
  t: (key: string) => string
) => {
  if (plan === "hobby") return t("environments.settings.billing.plan_hobby");
  if (plan === "pro") return t("environments.settings.billing.plan_pro");
  if (plan === "scale") return t("environments.settings.billing.plan_scale");
  if (plan === "custom") return t("environments.settings.billing.plan_custom");
  return t("environments.settings.billing.plan_unknown");
};

export const PricingTable = ({
  environmentId,
  organization,
  responseCount,
  projectCount,
  usageCycleStart,
  usageCycleEnd,
  hasBillingRights,
  currentCloudPlan,
  currentSubscriptionStatus,
  stripePublishableKey,
  stripePricingTableId,
  isStripeSetupIncomplete,
  trialDaysRemaining,
}: PricingTableProps) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRetryingStripeSetup, setIsRetryingStripeSetup] = useState(false);
  const [cancellingOn, setCancellingOn] = useState<Date | null>(null);
  const [pricingTableCustomerSessionClientSecret, setPricingTableCustomerSessionClientSecret] = useState<
    string | null
  >(null);

  const isUpgradeablePlan = currentCloudPlan === "hobby" || currentCloudPlan === "unknown";
  const isTrialing = currentSubscriptionStatus === "trialing";
  const showPricingTable =
    hasBillingRights && isUpgradeablePlan && !isTrialing && !!stripePublishableKey && !!stripePricingTableId;
  const canManageSubscription =
    hasBillingRights && !isUpgradeablePlan && !!organization.billing.stripeCustomerId;
  const stripeLocaleOverride = useMemo(
    () => getStripeLocaleOverride(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage]
  );
  const stripePricingTableProps = useMemo(() => {
    const props: Record<string, string> = {
      "pricing-table-id": stripePricingTableId ?? "",
      "publishable-key": stripePublishableKey ?? "",
    };

    if (stripeLocaleOverride) {
      props["__locale-override"] = stripeLocaleOverride;
    }

    if (pricingTableCustomerSessionClientSecret) {
      props["customer-session-client-secret"] = pricingTableCustomerSessionClientSecret;
    } else {
      props["client-reference-id"] = organization.id;
    }

    return props;
  }, [
    organization.id,
    pricingTableCustomerSessionClientSecret,
    stripeLocaleOverride,
    stripePricingTableId,
    stripePublishableKey,
  ]);

  useEffect(() => {
    if (searchParams.get("checkout_success")) {
      const timer = setTimeout(() => router.refresh(), 2500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!hasBillingRights || !canManageSubscription) {
        setCancellingOn(null);
        return;
      }

      try {
        const isSubscriptionCancelledResponse = await isSubscriptionCancelledAction({
          organizationId: organization.id,
        });
        if (isSubscriptionCancelledResponse?.data) {
          setCancellingOn(isSubscriptionCancelledResponse.data.date);
        }
      } catch {
        // Ignore permission/network failures here and keep rendering billing UI.
      }
    };
    checkSubscriptionStatus();
  }, [canManageSubscription, hasBillingRights, organization.id]);

  useEffect(() => {
    if (!showPricingTable) {
      setPricingTableCustomerSessionClientSecret(null);
      return;
    }

    if (globalThis.window !== undefined) {
      globalThis.window.sessionStorage.setItem(BILLING_CONFIRMATION_ENVIRONMENT_ID_KEY, environmentId);
    }

    const loadPricingTableCustomerSession = async () => {
      try {
        const response = await createPricingTableCustomerSessionAction({ environmentId });
        setPricingTableCustomerSessionClientSecret(response?.data?.clientSecret ?? null);
      } catch {
        setPricingTableCustomerSessionClientSecret(null);
      }
    };

    void loadPricingTableCustomerSession();
  }, [environmentId, showPricingTable]);

  const openCustomerPortal = async () => {
    const manageSubscriptionResponse = await manageSubscriptionAction({
      environmentId,
    });
    if (manageSubscriptionResponse?.data && typeof manageSubscriptionResponse.data === "string") {
      router.push(manageSubscriptionResponse.data);
    }
  };

  const openTrialPaymentCheckout = async () => {
    try {
      const response = await createTrialPaymentCheckoutAction({ environmentId });
      if (response?.data && typeof response.data === "string") {
        globalThis.location.href = response.data;
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  const retryStripeSetup = async () => {
    setIsRetryingStripeSetup(true);
    try {
      const response = await retryStripeSetupAction({ organizationId: organization.id });
      if (response?.data) {
        router.refresh();
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsRetryingStripeSetup(false);
    }
  };

  const responsesUnlimitedCheck = organization.billing.limits.monthly.responses === null;
  const projectsUnlimitedCheck = organization.billing.limits.projects === null;
  const usageCycleLabel = `${usageCycleStart.toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })} - ${usageCycleEnd.toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })}`;

  return (
    <main>
      <div className="flex max-w-4xl flex-col gap-4">
        {trialDaysRemaining !== null &&
          (organization.billing.stripe?.hasPaymentMethod ? (
            <TrialAlert trialDaysRemaining={trialDaysRemaining} hasPaymentMethod>
              <AlertDescription>
                {t("environments.settings.billing.trial_payment_method_added_description")}
              </AlertDescription>
            </TrialAlert>
          ) : (
            <TrialAlert trialDaysRemaining={trialDaysRemaining}>
              <AlertDescription>
                {t("environments.settings.billing.trial_alert_description")}
              </AlertDescription>
              {hasBillingRights && (
                <AlertButton onClick={() => void openTrialPaymentCheckout()}>
                  {t("environments.settings.billing.add_payment_method")}
                </AlertButton>
              )}
            </TrialAlert>
          ))}
        {isStripeSetupIncomplete && hasBillingRights && (
          <Alert variant="warning">
            <AlertTitle>{t("environments.settings.billing.stripe_setup_incomplete")}</AlertTitle>
            <AlertDescription>
              {t("environments.settings.billing.stripe_setup_incomplete_description")}
            </AlertDescription>
            <AlertButton onClick={() => void retryStripeSetup()} loading={isRetryingStripeSetup}>
              {t("environments.settings.billing.retry_setup")}
            </AlertButton>
          </Alert>
        )}
        <SettingsCard
          title={t("environments.settings.billing.subscription")}
          description={t("environments.settings.billing.subscription_description")}
          buttonInfo={
            (canManageSubscription && currentSubscriptionStatus !== "trialing") ||
            (hasBillingRights && !!organization.billing.stripe?.hasPaymentMethod)
              ? {
                  text: t("environments.settings.billing.manage_subscription"),
                  onClick: () => void openCustomerPortal(),
                  variant: "default",
                }
              : undefined
          }>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-700">
                {t("environments.settings.billing.your_plan")}
              </p>
              <div className="flex items-center gap-2">
                <Badge type="success" size="normal" text={getCurrentCloudPlanLabel(currentCloudPlan, t)} />
                {currentSubscriptionStatus === "trialing" && (
                  <Badge
                    type="warning"
                    size="normal"
                    text={t("environments.settings.billing.status_trialing")}
                  />
                )}
                {cancellingOn && (
                  <Badge
                    type="warning"
                    size="normal"
                    text={`${t("environments.settings.billing.cancelling")}: ${cancellingOn.toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      }
                    )}`}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <UsageCard
                metric={t("common.responses")}
                currentCount={responseCount}
                limit={organization.billing.limits.monthly.responses}
                isUnlimited={responsesUnlimitedCheck}
                unlimitedLabel={t("environments.settings.billing.unlimited_responses")}
              />

              <p className="text-sm text-slate-500">
                {t("environments.settings.billing.usage_cycle")}: {usageCycleLabel}
              </p>
            </div>
            <UsageCard
              metric={t("common.workspaces")}
              currentCount={projectCount}
              limit={organization.billing.limits.projects}
              isUnlimited={projectsUnlimitedCheck}
              unlimitedLabel={t("environments.settings.billing.unlimited_workspaces")}
            />
          </div>
        </SettingsCard>

        {currentCloudPlan === "pro" && !isTrialing && (
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-6">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold text-white">
                  {t("environments.settings.billing.scale_banner_title")}
                </h3>
                <p className="text-sm text-slate-300">
                  {t("environments.settings.billing.scale_banner_description")}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>&#10003; {t("environments.settings.billing.scale_feature_teams")}</span>
                  <span>&#10003; {t("environments.settings.billing.scale_feature_api")}</span>
                  <span>&#10003; {t("environments.settings.billing.scale_feature_quota")}</span>
                  <span>&#10003; {t("environments.settings.billing.scale_feature_spam")}</span>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={openCustomerPortal} className="shrink-0">
                {t("environments.settings.billing.upgrade")}
              </Button>
            </div>
          </div>
        )}

        {showPricingTable && (
          <div className="mb-12 w-full max-w-4xl">
            <Script src="https://js.stripe.com/v3/pricing-table.js" strategy="afterInteractive" />
            {createElement("stripe-pricing-table", stripePricingTableProps)}
          </div>
        )}
      </div>
    </main>
  );
};
