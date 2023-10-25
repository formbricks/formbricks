"use client";

import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { Badge } from "@formbricks/ui/Badge";
import { CheckIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";

// upated on 20th of July 2023
const stripeURl =
  process.env.NODE_ENV === "production"
    ? "https://buy.stripe.com/5kA9ABal07ZjgEw3cc"
    : "https://billing.formbricks.com/b/test_28o02W1MObwybewfZ1";

const stripeRemoveBrandingUrl =
  process.env.NODE_ENV === "production"
    ? "https://billing.formbricks.com/b/dR6eUV2Sy1AV5ZS001"
    : "https://billing.formbricks.com/b/test_5kA02WezAgQSdmEbIJ";

const customUrlStripeUrl =
  process.env.NODE_ENV === "production"
    ? "https://billing.formbricks.com/b/bIY9ABct893n4VO8wy"
    : "https://billing.formbricks.com/b/test_cN22b4gHIdEGciA9AC";

interface PricingTableProps {
  team: TTeam;
}

export default function PricingTable({ team }: PricingTableProps) {
  const router = useRouter();
  const [loadingCustomerPortal, setLoadingCustomerPortal] = useState(false);

  const openCustomerPortal = async () => {
    setLoadingCustomerPortal(true);
    const res = await fetch("/api/billing/create-customer-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stripeCustomerId: team.subscription?.stripeCustomerId,
        returnUrl: `${window.location}`,
      }),
    });
    if (!res.ok) {
      setLoadingCustomerPortal(false);
      alert("Error loading billing portal");
    }
    const {
      data: { sessionUrl },
    } = await res.json();
    router.push(sessionUrl);
  };

  const freeFeatures = [
    "Unlimited surveys",
    "Unlimited team members",
    "Remove branding",
    "Unlimited link survey responses",
    "100 responses per web-app survey",
    "Granular targeting",
    "In-product surveys",
    "Link surveys",
    "30+ templates",
    "API access",
    "Webhooks",
    "Integrations (Zapier)",
  ];

  const proFeatures = ["All features of Free plan", "Unlimited responses"];

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
              <h2 className="mr-2 inline-flex text-3xl font-bold text-slate-700">Free</h2>
              {team.subscription?.plan === "community" && (
                <Badge text="Current Plan" size="normal" type="success" />
              )}
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
              {team.subscription?.plan === "community" ? (
                <Button variant="minimal" disabled className="mt-6 w-full justify-center py-4 shadow-sm">
                  Your current plan
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() => openCustomerPortal()}>
                  Change Plan
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="">
          <div className="rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="mr-2 inline-flex text-3xl font-bold text-slate-700">Pro</h2>
              {team.subscription?.plan === "scale" && (
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
              {team.subscription?.plan === "scale" ? (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() => openCustomerPortal()}>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  variant="darkCTA"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => router.push(`${stripeURl}?client_reference_id=${team.id}`)}>
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1">
          <div className="rounded-lg border border-slate-100  shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-2xl font-bold text-slate-700">Remove Formbricks Branding</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Remove Formbricks branding from web-app surveys across all your products.
              </p>
              {team.subscription?.addOns.includes("removeBranding") ? (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() => openCustomerPortal()}>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  variant="darkCTA"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => router.push(`${stripeRemoveBrandingUrl}?client_reference_id=${team.id}`)}>
                  Buy for 10$ /month
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="rounded-lg border border-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-2xl font-bold text-slate-700">Custom URL for Link Surveys</h2>
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Use your own custom URL for link surveys.
              </p>
              {team.subscription?.addOns.includes("customUrl") ? (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() => openCustomerPortal()}>
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  variant="darkCTA"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => router.push(`${customUrlStripeUrl}?client_reference_id=${team.id}`)}>
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
