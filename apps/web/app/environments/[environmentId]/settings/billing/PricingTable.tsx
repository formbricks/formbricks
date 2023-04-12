"use client";
import { useState } from "react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeam } from "@/lib/teams";
import { Badge, Button, ErrorComponent } from "@formbricks/ui";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";

const stripeURl =
  process.env.NODE_ENV === "production"
    ? "https://buy.stripe.com/28o00R4GDf9qdfa5kp"
    : "https://buy.stripe.com/test_9AQfZw5CL9hmcXSdQQ";

interface PricingTableProps {
  environmentId: string;
  session: Session | null;
}

export default function PricingTable({ environmentId, session }: PricingTableProps) {
  const router = useRouter();
  const [loadingCustomerPortal, setLoadingCustomerPortal] = useState(false);
  const { team, isLoadingTeam, isErrorTeam } = useTeam(environmentId);

  if (isLoadingTeam) return <LoadingSpinner />;

  if (!session || isErrorTeam) return <ErrorComponent />;

  const openCustomerPortal = async () => {
    setLoadingCustomerPortal(true);
    const res = await fetch("/api/billing/create-customer-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stripeCustomerId: team.stripeCustomerId,
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
              <h2 className="inline-flex text-3xl font-bold text-slate-700">Free</h2>
              {session.user?.plan === "free" && <Badge text="Current Plan" size="normal" type="success" />}
              <p className="  mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Limited to 30 responses per survey.
              </p>
              <p className="mt-8">
                <span className="text-slate-80 text-2xl font-light">free</span>

                <span className="text-base font-medium text-slate-400 ">/ month</span>
              </p>
              {session.user?.plan === "free" ? (
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
          <div className="float-right -mt-2 mr-6 animate-bounce rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-50">
            Limited Early Bird Deal
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="inline-flex text-3xl font-bold text-slate-700">Pro</h2>
              {session.user?.plan === "pro" && <Badge text="Current Plan" size="normal" type="success" />}
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
                Unlimited surveys and responses.
              </p>
              <p className="mt-8">
                <span className="text-2xl font-bold text-slate-800">
                  <span className="mr-2 font-light line-through">$249</span>49$
                </span>

                <span className="text-base font-medium text-slate-400">/ month</span>
              </p>
              {session.user?.plan === "pro" ? (
                <Button
                  variant="secondary"
                  className="mt-6 w-full justify-center py-4 shadow-sm"
                  onClick={() => openCustomerPortal()}>
                  Change Plan
                </Button>
              ) : (
                <Button
                  variant="highlight"
                  className="mt-6 w-full justify-center py-4 text-white shadow-sm"
                  onClick={() => router.push(`${stripeURl}?client_reference_id=${team.id}`)}>
                  Upgrade
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
                href="https://formbricks.com/github"
                target="_blank">
                Learn more on GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
