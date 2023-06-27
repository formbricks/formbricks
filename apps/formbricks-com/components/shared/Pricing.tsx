import { Button } from "@formbricks/ui";
import clsx from "clsx";
import HeadingCentered from "./HeadingCentered";
import { CheckIcon } from "@heroicons/react/24/outline";
import { usePlausible } from "next-plausible";
import { useRouter } from "next/router";

const tiers = [
  {
    name: "Self-hosting",
    priceMonthly: "free",
    paymentRythm: "/always",
    button: "secondary",
    discounted: false,
    highlight: false,
    description: "Host Formbricks on your own server.",
    features: [
      "All Free features",
      "Easy self-hosting (Docker)",
      "Unlimited surveys",
      "Unlimited responses",
      "Unlimited team members",
    ],
    ctaName: "Read docs",
    plausibleGoal: "Pricing_CTA_SelfHosting",
    href: "/docs/self-hosting/deployment",
  },
  {
    name: "Free",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "$0",
    paymentRythm: "/month",
    button: "highlight",
    discounted: false,
    highlight: true,
    description: "All Pro features included.",
    features: [
      "Unlimited surveys",
      "Unlimited team members",
      "Granular targeting",
      "In-product surveys",
      "Link surveys",
      "30+ templates",
      "API access",
      "Integrations (Slack, PostHog, Zapier)",
      "100 responses per survey",
    ],
    ctaName: "Start for free",
    plausibleGoal: "Pricing_CTA_FreePlan",
  },
  {
    name: "Pro",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "$99",
    paymentRythm: "/month",
    button: "secondary",
    discounted: false,
    highlight: false,
    description: "All features included. Unlimited usage.",
    features: ["All features of Free plan", "Unlimited responses", "Remove branding"],
    ctaName: "Sign up now",
    plausibleGoal: "Pricing_CTA_ProPlan",
  },
];

export default function Pricing() {
  const plausible = usePlausible();
  const router = useRouter();

  return (
    <div className="-mt-10 pb-20">
      <div className="mx-auto max-w-7xl py-4 sm:px-6 sm:pb-6 lg:px-8" id="pricing">
        <HeadingCentered heading="One price, unlimited usage." teaser="Pricing" />

        <div className="mx-auto  space-y-4 px-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:px-0">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                `h-fit rounded-lg shadow-sm`,
                tier.highlight
                  ? "border border-slate-300 bg-slate-200 dark:border-slate-500 dark:bg-slate-800"
                  : "bg-slate-100 dark:bg-slate-700"
              )}>
              <div className="p-8">
                <h2
                  className={clsx(
                    "inline-flex text-3xl font-bold",
                    tier.highlight
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-500 dark:text-slate-300"
                  )}>
                  {tier.name}
                </h2>
                <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {tier.description}
                </p>
                <ul className="mt-4 space-y-4">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:border-green-600 dark:bg-green-900">
                        <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-300" />
                      </div>
                      <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-8">
                  <span
                    className={clsx(
                      `text-4xl font-light`,
                      tier.highlight
                        ? "text-slate-800 dark:text-slate-100"
                        : "text-slate-500 dark:text-slate-200",
                      tier.discounted ? "decoration-brand line-through" : ""
                    )}>
                    {tier.priceMonthly}
                  </span>{" "}
                  <span className="text-4xl font-bold text-slate-900 dark:text-slate-50">
                    {tier.discounted && "$49"}
                  </span>
                  <span
                    className={clsx(
                      "text-base font-medium",
                      tier.highlight
                        ? "text-slate-500 dark:text-slate-400"
                        : "text-slate-400 dark:text-slate-500"
                    )}>
                    {tier.paymentRythm}
                  </span>
                </p>

                <Button
                  onClick={() => {
                    plausible(`${tier.plausibleGoal}`);
                    router.push(`${tier.href}`);
                  }}
                  className={clsx(
                    "mt-6 w-full justify-center py-4 text-lg shadow-sm",
                    tier.highlight
                      ? ""
                      : "bg-slate-300 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500"
                  )}
                  variant={tier.highlight ? "highlight" : "secondary"}>
                  {tier.ctaName}
                </Button>

                {tier.name === "Free" && (
                  <p className="mt-1.5 text-center text-xs text-slate-500">No Creditcard required.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
