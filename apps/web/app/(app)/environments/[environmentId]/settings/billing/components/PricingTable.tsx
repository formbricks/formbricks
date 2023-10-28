"use client";

import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { Badge } from "@formbricks/ui/Badge";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";
import {
  manageSubscriptionAction,
  removeSubscriptionAction,
  upgradePlanAction,
} from "@/app/(app)/environments/[environmentId]/settings/billing/actions";

import { priceLookupKeys } from "@formbricks/ee/billing/utils/products";

interface BillingDetails {
  people: number;
  display: number;
}

interface PricingTableProps {
  team: TTeam;
  environmentId: string;
  billingDetails: BillingDetails;
}

export default function PricingTableComponent({ team, environmentId, billingDetails }: PricingTableProps) {
  const router = useRouter();
  const [loadingCustomerPortal, setLoadingCustomerPortal] = useState(false);
  const { people, display } = billingDetails;

  const openCustomerPortal = async () => {
    setLoadingCustomerPortal(true);
    const sessionUrl = await manageSubscriptionAction(team.id, environmentId);
    router.push(sessionUrl);
    setLoadingCustomerPortal(true);
  };

  const upgradePlan = async (priceNickname: string) => {
    setLoadingCustomerPortal(true);
    const paymentUrl = await upgradePlanAction(team.id, environmentId, priceNickname);
    setLoadingCustomerPortal(false);
    router.push(paymentUrl);
  };

  const freeFeatures = [
    "Unlimited surveys",
    "Granular targeting",
    "30+ templates",
    "API access",
    "Third Party Integrations",
    "Unlimited Responses per Survey",
  ];

  const proFeatures = [
    "All features of Free plan",
    "Team Role Management",
    "Advanced User Targeting",
    "Multi Language Surveys",
  ];

  return (
    <div className="relative">
      {loadingCustomerPortal && (
        <div className="absolute h-full w-full rounded-lg bg-slate-900/5">
          <LoadingSpinner />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 rounded-lg bg-white p-8">
        <div className="">
          <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
            <div className="p-8">
              <h2 className="mr-2 inline-flex text-3xl font-bold text-slate-700">Base Plan</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Always free. Giving back to the community.
              </p>
              <ul className="mt-4 space-y-4">
                {freeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                      <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                    </div>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-3xl">
                <span className="text-slate-800font-light">Always free</span>
              </p>
              <Button
                variant="secondary"
                className="mt-6 w-full justify-center py-4 shadow-sm"
                disabled={true}>
                Free Plan
              </Button>
              <Button
                variant="secondary"
                className="mt-6 w-full justify-center py-4 shadow-sm"
                onClick={() => openCustomerPortal()}>
                Open Customer Portal
              </Button>
            </div>
          </div>
        </div>
        <div className="">
          <div className="rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="mr-2 inline-flex text-3xl font-bold text-slate-700">App Surveys</h2>
              {team.billing.features.appSurvey.status === "active" && (
                <Badge text="Current Plan" size="normal" type="success" />
              )}
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                All features included. Unlimited usage.
              </p>
              <ul className="mt-4 space-y-4">
                {proFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                      <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                    </div>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6">
                <span className="text-3xl font-bold text-slate-800">$99</span>

                <span className="text-base font-medium text-slate-400">/ month</span>
              </p>
              {team.billing.features.appSurvey.status === "active" ? (
                <div>
                  <Button
                    variant="secondary"
                    className="mt-6 w-full justify-center py-4 shadow-sm"
                    onClick={() =>
                      removeSubscriptionAction(
                        team.id,
                        environmentId,
                        priceLookupKeys[priceLookupKeys.appSurvey]
                      )
                    }>
                    Manage Subscription
                  </Button>
                  <p className="mt-2 whitespace-pre-wrap text-center text-sm text-slate-600">
                    People Tracked: {`${people}`}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-center text-sm text-slate-600">
                    Displays Tracked: {`${display}`}
                  </p>
                </div>
              ) : (
                <Button
                  variant="darkCTA"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => upgradePlan(priceLookupKeys[priceLookupKeys.appSurvey])}>
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="rounded-lg border border-slate-100  shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-2xl font-bold text-slate-700">Link Surveys</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Remove Formbricks branding from web-app surveys across all your products.
              </p>
              {team.billing.features.linkSurvey.status === "active" ? (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() =>
                    removeSubscriptionAction(
                      team.id,
                      environmentId,
                      priceLookupKeys[priceLookupKeys.linkSurvey]
                    )
                  }>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  variant="darkCTA"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => upgradePlan(priceLookupKeys[priceLookupKeys.linkSurvey])}>
                  Buy for 10$ /month
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="rounded-lg border border-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-2xl font-bold text-slate-700">User Targeting</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Use your own custom URL for link surveys.
              </p>
              {team.billing.features.userTargeting.status === "active" ? (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() =>
                    removeSubscriptionAction(
                      team.id,
                      environmentId,
                      priceLookupKeys[priceLookupKeys.userTargeting]
                    )
                  }>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  variant="darkCTA"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => upgradePlan(priceLookupKeys[priceLookupKeys.userTargeting])}>
                  Buy for 10$ /month
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-2">
          <div className="rounded-lg border border-slate-100  shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-2xl font-bold text-slate-700">Open-source</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Self-host Formbricks with all perks: Data ownership, customizability, limitless use.
              </p>
              <Button
                variant="secondary"
                className="mt-6 justify-center py-4 shadow-sm"
                href="https://formbricks.com/docs/self-hosting/deployment"
                target="_blank">
                Read Deployment Docs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
