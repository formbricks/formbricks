import { useRouter } from "next/router";
import HeadingCentered from "./HeadingCentered";
import clsx from "clsx";
import { Button } from "@formbricks/ui";
import EarlyBirdDeal from "./EarlyBirdDeal";

const tiers = [
  {
    name: "Self-hosting",
    href: "#",
    priceMonthly: "tba",
    button: "secondary",
    discounted: false,
    highlight: false,
    paymentRythm: "/month",
    description: "Host Formbricks on your own server.",
    ctaName: "Contact us",
    ctaAction: () => window.open("mailto:hola@formbricks.com"),
  },
  {
    name: "Cloud",
    href: "#",
    priceMonthly: "$99",
    button: "highlight",
    discounted: true,
    highlight: true,
    paymentRythm: "/month",
    description: "Use the managed cloud, gather insights immediately.",
    ctaName: "Sign up now",
    ctaAction: () => window.open("https://app.formbricks.com/auth/signup"),
  },
];

export default function PricingPmf() {
  const router = useRouter();
  return (
    <div className="-mt-10 pb-20">
      <div className="mx-auto max-w-7xl py-4 sm:px-6 sm:pb-6 lg:px-8 ">
        <HeadingCentered heading="One price, unlimited usage." teaser="Pricing" />

        <div className="mx-auto space-y-4 px-4 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0 md:px-0 lg:max-w-5xl">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                `rounded-lg shadow-sm`,
                tier.highlight
                  ? "border border-slate-300 bg-slate-200 dark:border-slate-500 dark:bg-slate-600"
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
                    className="mt-6 w-full justify-center py-4 text-lg shadow-sm"
                    variant={tier.highlight ? "highlight" : "secondary"}>
                    {tier.ctaName}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-5xl">
        <EarlyBirdDeal />
      </div>
    </div>
  );
}
