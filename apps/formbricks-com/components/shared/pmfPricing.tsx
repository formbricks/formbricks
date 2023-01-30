import { ArrowRightIcon, EnvelopeIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/router";
import { Fragment, useState } from "react";
import HeadingCentered from "./HeadingCentered";
import clsx from "clsx";
import Button from "@/components/shared/Button";
import Image from "next/image";
import EarlyBird from "@/images/early bird deal for open source jotform alternative typeform and surveymonkey_v2.svg";

const tiers = [
  {
    name: "Self-hosting",
    href: "#",
    priceMonthly: "$99",
    button: "secondary",
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
    highlight: true,
    paymentRythm: "/month",
    description: "Use the managed cloud, gather insights immediately.",
    ctaName: "Sign Up",
    ctaAction: () => window.open("https://app.formbricks.com"),
  },
];

export default function Pricelist() {
  const router = useRouter();
  return (
    <div className="bg-gradient-radial from-deeppurple-light to-deeppurple pb-20">
      <div className="mx-auto max-w-7xl py-4 pt-20 sm:py-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
        <HeadingCentered heading="One price, all features." teaser="Pricing" />

        <div className="mx-auto space-y-4 px-4 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0 md:px-0 lg:max-w-5xl">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(`rounded-lg shadow-sm`, tier.highlight ? "bg-slate-300" : "bg-slate-100")}>
              <div className="p-8">
                <h2
                  className={clsx(
                    "inline-flex text-3xl font-bold",
                    tier.highlight ? "text-slate-700" : "text-slate-400"
                  )}>
                  {tier.name}
                </h2>
                <p
                  className={clsx(
                    "mt-4 whitespace-pre-wrap text-sm",
                    tier.highlight ? "text-gray-600" : "text-gray-400"
                  )}>
                  {tier.description}
                </p>
                <p className="mt-8">
                  <span
                    className={clsx(
                      `text-4xl font-light`,
                      tier.highlight ? "text-slate-800" : "text-slate-400"
                    )}>
                    {tier.priceMonthly}
                  </span>{" "}
                  <span
                    className={clsx(
                      "text-base font-medium",
                      tier.highlight ? "text-gray-500" : "text-gray-300"
                    )}>
                    {tier.paymentRythm}
                  </span>
                </p>
                {tier.ctaName && tier.ctaAction && (
                  <Button
                    onClick={tier.ctaAction}
                    className="mt-6 w-full justify-center py-4 text-lg shadow-sm"
                    variant={tier.button}>
                    {tier.ctaName}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="from-red to-pink relative max-w-7xl overflow-hidden rounded-xl bg-gradient-to-r p-6 pb-16 sm:p-8 sm:pb-16 md:py-8 md:px-12 lg:flex lg:items-center">
          <div className="lg:w-0 lg:flex-1 ">
            <h2
              className="mb-1 text-2xl font-bold tracking-tight text-white sm:text-2xl"
              id="newsletter-headline">
              50% off for early birds.
            </h2>
            <h2 className="text-xl font-semibold tracking-tight text-red-200 sm:text-lg">
              Limited Early Bird deal. Only{" "}
              <span className="text-red rounded-sm bg-red-200 px-2 py-0.5">12</span> left.
            </h2>

            <div className="mt-6">
              <Button onClick={() => router.push("https://app.formbricks.com")}>Get Early Bird Deal</Button>
            </div>
            <p className="mt-2 mb-24 max-w-3xl text-xs tracking-tight text-red-200 md:mb-0 md:max-w-sm lg:max-w-none">
              This saves you $588 every year.
            </p>
            <div className="absolute -right-20 -bottom-36 mx-auto h-96 w-96 scale-75 sm:-right-10">
              <Image src={EarlyBird} fill alt="formbricks favicon open source forms typeform alternative" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
