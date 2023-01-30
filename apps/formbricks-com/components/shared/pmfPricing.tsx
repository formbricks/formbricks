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
    ctaAction: () => window.open("https://app.formbricks.com"),
  },
];

export default function PmfPricing() {
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
                tier.highlight ? "border-2 border-slate-400 bg-slate-300" : "bg-slate-100"
              )}>
              <div className="p-8">
                <h2
                  className={clsx(
                    "inline-flex text-3xl font-bold",
                    tier.highlight ? "text-slate-700" : "text-slate-500"
                  )}>
                  {tier.name}
                </h2>
                <p
                  className={clsx(
                    "mt-4 whitespace-pre-wrap text-sm",
                    tier.highlight ? "text-gray-600" : "text-gray-500"
                  )}>
                  {tier.description}
                </p>
                <p className="mt-8">
                  <span
                    className={clsx(
                      `text-4xl font-light`,
                      tier.highlight ? "text-slate-800" : "text-slate-500",
                      tier.discounted ? "decoration-brand line-through" : ""
                    )}>
                    {tier.priceMonthly}
                  </span>{" "}
                  <span className="text-4xl font-bold text-slate-900">{tier.discounted && "$49"}</span>
                  <span
                    className={clsx(
                      "text-base font-medium",
                      tier.highlight ? "text-gray-500" : "text-gray-400"
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
