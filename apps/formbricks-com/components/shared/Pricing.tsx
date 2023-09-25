import HeadingCentered from "./HeadingCentered";
import { usePlausible } from "next-plausible";
import { useRouter } from "next/router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import PricingCard from "./PricingCard";

const tiers = [
  {
    type: "self-hosting",
    name: "Community",
    priceMonthly: "free",
    paymentRythm: "/always",
    button: "secondary",
    discounted: false,
    highlight: false,
    description: "Host Formbricks on your own server.",
    features: [
      "All Free features",
      "Easy self-hosting (Docker)",
      "Remove Branding",
      "Custom URL for Link Surveys",
      "Unlimited MTU",
    ],
    ctaName: "Read docs",
    plausibleGoal: "Pricing_CTA_SelfHosting",
    href: "/docs/self-hosting/deployment",
  },
  {
    type: "self-hosting",
    name: "License",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "$99",
    paymentRythm: "/month",
    button: "secondary",
    discounted: false,
    highlight: false,
    description: "Get all the Premium features from the Scale plan and host it yourself.",
    features: [
      "All Free features",
      "Multi Language",
      "Latest Premium Features as & when they arrive in the Scale plan",
    ],
    ctaName: "Start for free",
    plausibleGoal: "Pricing_CTA_ProPlan",
  },
  {
    type: "cloud",
    name: "Community",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "free",
    paymentRythm: "/month",
    button: "highlight",
    discounted: false,
    highlight: true,
    description: "Start with the Free plan.",
    features: [
      "Unlimited surveys",
      "Unlimited responses",
      "Web-App surveys",
      "Link surveys",
      "Granular targeting",
      "30+ templates",
      "API access",
      "Integrations (Zapier, Make, ...)",
      "Unlimited team members",
      "Up to 5K MTU",
    ],
    alaCarteFeatures: ["Remove Branding: $10 / month", "Custom URL for Link Surveys: $10 / month"],
    ctaName: "Get started",
    plausibleGoal: "Pricing_CTA_FreePlan",
  },
  {
    type: "cloud",
    name: "Scale",
    href: "https://app.formbricks.com/auth/signup",
    priceMonthly: "$99",
    paymentRythm: "/user /month",
    button: "secondary",
    discounted: false,
    highlight: false,
    description:
      "Pay as and only when the you have more than 5K MTU. \n(Monthly Tracked Users: Users/Sessions that interact with Formbricks).",
    features: ["All Free features", "Multi Language", "Unlimited MTU (<5k MTU free)"],
    alaCarteFeatures: ["Remove Branding: $10 / month", "Custom URL (Link Survey): $10 / month"],
    ctaName: "Start for free",
    plausibleGoal: "Pricing_CTA_ProPlan",
  },
];

export default function Pricing() {
  const plausible = usePlausible();
  const router = useRouter();
  const [sliderValue, setSliderValue] = useState(5);

  return (
    <div className="-mt-10 pb-20">
      <div className="mx-auto max-w-7xl py-4 sm:px-6 sm:pb-6 lg:px-8" id="pricing">
        <HeadingCentered heading="One price, unlimited usage." teaser="Pricing" />
        <Tabs defaultValue="Cloud" className="text-center">
          <TabsList className="mb-4">
            <TabsTrigger
              value="Self-Hosted"
              className="mx-auto mt-3 max-w-3xl rounded-lg text-xl text-slate-500 dark:text-slate-300 sm:mt-4">
              Self Hosted
            </TabsTrigger>
            <TabsTrigger
              value="Cloud"
              className="mx-auto mt-3 max-w-3xl rounded-lg text-xl text-slate-500 dark:text-slate-300 sm:mt-4">
              Cloud
            </TabsTrigger>
          </TabsList>

          <TabsContent value="Self-Hosted">
            <TiersList
              type="self-hosting"
              sliderValue={sliderValue}
              setSliderValue={setSliderValue}
              plausible={plausible}
              router={router}
            />
          </TabsContent>

          <TabsContent value="Cloud">
            <TiersList
              type="cloud"
              sliderValue={sliderValue}
              setSliderValue={setSliderValue}
              plausible={plausible}
              router={router}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const TiersList = ({ type, sliderValue, setSliderValue, plausible, router }) => (
  <div className="mx-auto space-y-4 px-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:px-0">
    {tiers
      .filter((tier) => tier.type === type)
      .map((tier) => (
        <PricingCard
          tier={tier}
          sliderValue={sliderValue}
          setSliderValue={setSliderValue}
          plausible={plausible}
          router={router}
        />
      ))}
  </div>
);
