import { Button } from "@formbricks/ui";
import clsx from "clsx";
import EarlyBirdDeal from "./EarlyBirdDeal";
import HeadingCentered from "./HeadingCentered";

const tiers = [
  {
    name: "Self-hosting",
    href: "https://formbricks.com/github",
    priceMonthly: "free",
    button: "secondary",
    discounted: false,
    highlight: false,
    paymentRythm: "/always",
    description: "Host Formbricks on your own server.",
    ctaName: "View Code",
    ctaAction: () => window.open("https://formbricks.com/github"),
  },
  {
    name: "Free",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "$0",
    button: "highlight",
    discounted: false,
    highlight: false,
    paymentRythm: "/month",
    description: "All features. 30 responses per survey.",
    ctaName: "Sign up now",
    ctaAction: () => window.open("https://app.formbricks.com/auth/signup"),
  },
  {
    name: "Pro",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "$99",
    button: "secondary",
    discounted: true,
    highlight: true,
    paymentRythm: "/month",
    description: "All features included. No limits.",
    ctaName: "Sign up now",
    ctaAction: () => window.open("https://app.formbricks.com/auth/signup"),
  },
];

export default function PricingPmf() {
  return (
    <div className="-mt-10 pb-20">
      <div className="mx-auto max-w-7xl py-4 sm:px-6 sm:pb-6 lg:px-8" id="pricing">
        <HeadingCentered heading="One price, unlimited usage." teaser="Pricing" />

        <div className="mx-auto space-y-4 px-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0 lg:px-0">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                `rounded-lg shadow-sm`,
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
                <p
                  className={clsx(
                    "mt-4 whitespace-pre-wrap text-sm",
                    tier.highlight
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-500 dark:text-slate-300"
                  )}>
                  {tier.description}
                </p>
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
                {tier.ctaName && tier.ctaAction && (
                  <Button
                    onClick={tier.ctaAction}
                    className={clsx(
                      "mt-6 w-full justify-center py-4 text-lg shadow-sm",
                      tier.highlight
                        ? ""
                        : "bg-slate-300 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500"
                    )}
                    variant={tier.highlight ? "highlight" : "secondary"}>
                    {tier.ctaName}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <EarlyBirdDeal />
      </div>
    </div>
  );
}
