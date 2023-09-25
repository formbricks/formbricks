import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from "@formbricks/ui";
import { CheckIcon, CurrencyDollarIcon } from "@heroicons/react/24/solid";
import { Slider } from "./Slider";
import clsx from "clsx";

interface Props {
  tier: any;
  sliderValue: number;
  setSliderValue: any;
  plausible: any;
  router: any;
}

function calculateCost(mtuWithoutK: number): string {
  const mtu = mtuWithoutK * 1000;
  if (mtu <= 5000) {
    return "0";
  }
  let regularPrice = Math.ceil((mtu - 5000) / 10000) * 50;

  // Calculate the logarithmic discount factor
  let discountFactor = Math.log(mtu / 5000);

  // 10% max discount based on the logarithmic growth
  let discount = regularPrice * (0.1 * discountFactor);

  // Ensure we don't exceed the 10% discount
  if (discount > regularPrice * 0.1) {
    discount = regularPrice * 0.1;
  }

  // Calculate the final price after applying the discount
  return ((regularPrice - discount) / mtu).toFixed(4);
}

export default function PricingCard({ tier, sliderValue, setSliderValue, plausible, router }: Props) {
  return (
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
            tier.highlight ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-300"
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
              <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                {feature.includes("MTU") ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>{feature}</TooltipTrigger>
                      <TooltipContent side={"right"}>
                        <div className="text-center">
                          <p className="w-60 pb-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
                            <b>MTU: Monthly Tracked Users</b> <br />
                            For in-app tracking: Think of an MTU as any new device or person that interacts
                            with Formbricks app.
                            <br />
                            <br />
                            For link surveys: An MTU is counted every time a visitor interacts with the survey
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400"></p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  feature
                )}
              </span>
            </li>
          ))}
          {tier.alaCarteFeatures &&
            tier.alaCarteFeatures.map((feature, index) => (
              <li key={index} className="flex items-start">
                <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:border-green-600 dark:bg-green-900">
                  <CurrencyDollarIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-300" />
                </div>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>{feature}</TooltipTrigger>
                      <TooltipContent side={"right"}>
                        <div className="text-center">
                          <p className="w-60 pb-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
                            Pay for this if and when you need it.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </li>
            ))}
        </ul>
        <p className="mt-8">
          {tier.name == "Scale" && (
            <>
              <div className="mb-4">
                <Slider
                  defaultValue={[sliderValue]}
                  min={5}
                  max={100}
                  step={10}
                  onValueChange={(value) => setSliderValue(value[0])}
                />
              </div>
              {tier.name == "Scale" && (
                <div className="whitespace-pre-wrap pb-2 text-sm text-slate-600 dark:text-slate-300">
                  Up to {sliderValue}k MTU
                </div>
              )}
            </>
          )}
          <span
            className={clsx(
              `text-4xl font-light`,
              tier.highlight ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-200",
              tier.discounted ? "decoration-brand line-through" : ""
            )}>
            {tier.name == "Scale" ? <span>{calculateCost(sliderValue)}$ </span> : tier.priceMonthly}
          </span>{" "}
          <span className="text-4xl font-bold text-slate-900 dark:text-slate-50">
            {tier.discounted && "$49"}
          </span>
          <span
            className={clsx(
              "text-base font-medium",
              tier.highlight ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
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
            tier.highlight ? "" : "bg-slate-300 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500"
          )}
          variant={tier.highlight ? "highlight" : "secondary"}>
          {tier.ctaName}
        </Button>

        {tier.name === "Community" && tier.type === "cloud" && (
          <p className="mt-1.5 text-center text-xs text-slate-500">No Creditcard required.</p>
        )}
      </div>
    </div>
  );
}
