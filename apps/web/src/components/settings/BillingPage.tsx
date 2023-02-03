"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useOrganisation } from "@/lib/organisations";
import PricingTable from "@formbricks/ee/billing/components/PricingTable";
import { Button } from "@formbricks/ui";
import { useRouter } from "next/router";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const [loadingCustomerPortal, setLoadingCustomerPortal] = useState(false);
  const { organisation, isLoadingOrganisation, isErrorOrganisation } = useOrganisation(
    router.query.organisationId?.toString()
  );

  const openCustomerPortal = async () => {
    setLoadingCustomerPortal(true);
    const res = await fetch("/api/billing/create-customer-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stripeCustomerId: organisation.stripeCustomerId,
        returnUrl: `${window.location}`,
      }),
    });
    if (!res.ok) {
      setLoadingCustomerPortal(false);
      alert("Error loading billing portal");
    }
    const { sessionUrl } = await res.json();
    router.push(sessionUrl);
  };

  if (isLoadingOrganisation) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorOrganisation) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Billing
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {organisation.name}
          </span>
        </h1>
      </header>
      {organisation.plan === "free" ? (
        <>
          <div className="my-6 sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Upgrade to benefit from all features</h1>
            <p className="mt-2 text-sm text-gray-700">
              You do not currently have an active subscription. Upgrade to get access to all features and
              improve your user research.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg">
            <PricingTable organisationId={organisation.id} />
          </div>
        </>
      ) : (
        <>
          <div className="my-6 sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">View and manage your billing details</h1>
            <p className="mt-2 text-sm text-gray-700">
              View and edit your billing details, as well as cancel your subscription.
            </p>
          </div>
          <Button onClick={() => openCustomerPortal()} loading={loadingCustomerPortal}>
            Billing Portal
          </Button>
        </>
      )}
    </div>
  );
}
