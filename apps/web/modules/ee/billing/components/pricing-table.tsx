"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { createElement, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  createPricingTableCustomerSessionAction,
  isSubscriptionCancelledAction,
  manageSubscriptionAction,
} from "../actions";
import { BillingSlider } from "./billing-slider";

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

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  responseCount: number;
  projectCount: number;
  hasBillingRights: boolean;
  stripePublishableKey: string | null;
  stripePricingTableId: string | null;
}

const getCurrentCloudPlan = (
  organization: TOrganization
): "hobby" | "pro" | "scale" | "trial" | "unknown" => {
  if (organization.billing?.stripe?.plan) {
    return organization.billing.stripe.plan;
  }

  if (organization.billing.plan === "free") return "hobby";
  if (organization.billing.plan === "startup") return "pro";
  if (organization.billing.plan === "custom") return "scale";

  return "unknown";
};

const getCurrentCloudPlanLabel = (
  plan: "hobby" | "pro" | "scale" | "trial" | "unknown",
  t: (key: string) => string
) => {
  if (plan === "hobby") return t("environments.settings.billing.plan_hobby");
  if (plan === "pro") return t("environments.settings.billing.plan_pro");
  if (plan === "scale") return t("environments.settings.billing.plan_scale");
  if (plan === "trial") return t("environments.settings.billing.plan_trial");
  return t("environments.settings.billing.plan_unknown");
};

export const PricingTable = ({
  environmentId,
  organization,
  responseCount,
  projectCount,
  hasBillingRights,
  stripePublishableKey,
  stripePricingTableId,
}: PricingTableProps) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [cancellingOn, setCancellingOn] = useState<Date | null>(null);
  const [pricingTableCustomerSessionClientSecret, setPricingTableCustomerSessionClientSecret] = useState<
    string | null
  >(null);

  const currentCloudPlan = useMemo(() => getCurrentCloudPlan(organization), [organization]);
  const showPricingTable =
    hasBillingRights && currentCloudPlan === "hobby" && !!stripePublishableKey && !!stripePricingTableId;
  const canManageSubscription =
    hasBillingRights && currentCloudPlan !== "hobby" && !!organization.billing.stripeCustomerId;
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

    const loadPricingTableCustomerSession = async () => {
      const response = await createPricingTableCustomerSessionAction({ environmentId });
      setPricingTableCustomerSessionClientSecret(response?.data?.clientSecret ?? null);
    };

    loadPricingTableCustomerSession();
  }, [environmentId, showPricingTable]);

  const openCustomerPortal = async () => {
    const manageSubscriptionResponse = await manageSubscriptionAction({
      environmentId,
    });
    if (manageSubscriptionResponse?.data && typeof manageSubscriptionResponse.data === "string") {
      router.push(manageSubscriptionResponse.data);
    }
  };

  const responsesUnlimitedCheck =
    currentCloudPlan === "scale" && organization.billing.limits.monthly.responses === null;
  const projectsUnlimitedCheck =
    currentCloudPlan === "scale" && organization.billing.limits.projects === null;

  return (
    <main>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col">
          <div className="flex w-full">
            <h2 className="mb-3 mr-2 inline-flex w-full text-2xl font-bold text-slate-700">
              {t("environments.settings.billing.current_plan")}:{" "}
              <span className="capitalize">{getCurrentCloudPlanLabel(currentCloudPlan, t)}</span>
              {cancellingOn && (
                <Badge
                  className="mx-2"
                  size="normal"
                  type="warning"
                  text={`Cancelling: ${
                    cancellingOn
                      ? cancellingOn.toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })
                      : ""
                  }`}
                />
              )}
            </h2>

            {canManageSubscription && (
              <div className="flex w-full justify-end">
                <Button
                  size="sm"
                  variant="default"
                  className="justify-center py-2 shadow-sm"
                  onClick={openCustomerPortal}>
                  {t("environments.settings.billing.manage_subscription")}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-col rounded-xl border border-slate-200 bg-white py-4 shadow-sm dark:bg-slate-800">
            <div
              className={cn(
                "relative mx-8 mb-8 flex flex-col gap-4",
                responsesUnlimitedCheck && "mb-0 flex-row"
              )}>
              <p className="text-md font-semibold text-slate-700">{t("common.responses")}</p>
              {organization.billing.limits.monthly.responses && (
                <BillingSlider
                  className="slider-class mb-8"
                  value={responseCount}
                  max={organization.billing.limits.monthly.responses * 1.5}
                  freeTierLimit={organization.billing.limits.monthly.responses}
                  metric={t("common.responses")}
                />
              )}

              {responsesUnlimitedCheck && (
                <Badge
                  type="success"
                  size="normal"
                  text={t("environments.settings.billing.unlimited_responses")}
                />
              )}
            </div>

            <div
              className={cn(
                "relative mx-8 flex flex-col gap-4 pb-6",
                projectsUnlimitedCheck && "mb-0 mt-4 flex-row pb-0"
              )}>
              <p className="text-md font-semibold text-slate-700">{t("common.workspaces")}</p>
              {organization.billing.limits.projects && (
                <BillingSlider
                  className="slider-class mb-8"
                  value={projectCount}
                  max={organization.billing.limits.projects * 1.5}
                  freeTierLimit={organization.billing.limits.projects}
                  metric={t("common.workspaces")}
                />
              )}

              {projectsUnlimitedCheck && (
                <Badge
                  type="success"
                  size="normal"
                  text={t("environments.settings.billing.unlimited_workspaces")}
                />
              )}
            </div>
          </div>
        </div>

        {showPricingTable && (
          <div className="mb-12 w-full">
            <div className="w-full">
              <div className="mx-auto w-full max-w-[1200px]">
                <Script src="https://js.stripe.com/v3/pricing-table.js" strategy="afterInteractive" />
                {createElement("stripe-pricing-table", stripePricingTableProps)}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
