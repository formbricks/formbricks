import { CheckIcon } from "lucide-react";

import { TTeam } from "@formbricks/types/teams";

import { Badge } from "../Badge";
import { BillingSlider } from "../BillingSlider";
import { Button } from "../Button";

export const PricingCard = ({
  title,
  subtitle,
  featureName,
  monthlyPrice,
  actionText,
  team,
  metric,
  sliderValue,
  sliderLimit,
  freeTierLimit,
  paidFeatures,
  perMetricCharge,
  loading,
  onUpgrade,
  onUnsubscribe,
}: {
  title: string;
  subtitle: string;
  featureName: string;
  monthlyPrice: number;
  actionText: string;
  team: TTeam;
  metric?: string;
  sliderValue?: number;
  sliderLimit?: number;
  freeTierLimit?: number;
  paidFeatures: {
    title: string;
    comingSoon?: boolean;
    unlimited?: boolean;
  }[];
  perMetricCharge?: number;
  loading: boolean;
  onUpgrade: any;
  onUnsubscribe: any;
}) => {
  const featureNameKey = featureName as keyof typeof team.billing.features;
  return (
    <div className="mt-8 rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
      <div className="relative p-8">
        <h2 className="mr-2 inline-flex text-2xl font-bold text-slate-700">{title}</h2>
        {team.billing.features[featureNameKey].status === "active" ? (
          team.billing.features[featureNameKey].unlimited ? (
            <Badge text="Unlimited" size="normal" type="success" />
          ) : (
            <>
              <Badge text="Subscribed" size="normal" type="success" />
              <Button
                variant="secondary"
                onClick={(e) => onUnsubscribe(e)}
                className="absolute right-12 top-10">
                Unsubscribe
              </Button>
            </>
          )
        ) : team.billing.features[featureNameKey].status === "cancelled" ? (
          <Badge text="Cancelling at End of this Month" size="normal" type="warning" />
        ) : null}

        <p className=" mt-1 whitespace-pre-wrap text-sm text-slate-600">{subtitle}</p>

        {metric && perMetricCharge && (
          <div className="rounded-xl bg-slate-100 py-4 dark:bg-slate-800">
            <div className="mb-2 flex items-center gap-x-4"></div>
            {team.billing.features[featureNameKey].unlimited ? (
              <p>
                <span className="text-sm font-medium text-slate-400">
                  Usage this month: {sliderValue} {metric}
                </span>
              </p>
            ) : (
              <div className="relative mb-16 mt-4">
                <BillingSlider
                  className="slider-class"
                  value={sliderValue || 0}
                  max={sliderLimit || 100}
                  freeTierLimit={freeTierLimit || 0}
                  metric={metric}
                />
              </div>
            )}
            <hr className="mt-6" />
          </div>
        )}

        <div className="flex py-3">
          <div className="w-3/5">
            {team.billing.features[featureNameKey].status === "inactive" && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                You&apos;re on the <b>Free plan</b> in {title}.<br />
                Upgrade now to unlock the following:
              </p>
            )}

            <ul className="mt-4 space-y-4">
              {paidFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                    <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                  </div>
                  <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature.title}</span>
                  {feature.comingSoon && (
                    <span className="mx-2 rounded bg-blue-100 px-3 py-1 text-xs text-blue-700 dark:bg-slate-700 dark:text-teal-500">
                      coming soon
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="ml-6 flex w-2/5 flex-col items-end space-y-2">
            {!team.billing.features[featureNameKey].unlimited && (
              <div className="my-2">
                {team.billing.features[featureNameKey].status !== "inactive" ? (
                  <div className="mt-8">
                    {perMetricCharge ? (
                      <>
                        <span className="text-sm font-medium text-slate-400">Approximately</span>
                        <br />

                        <span className="text-3xl font-bold text-slate-800">$</span>
                        <span className="text-3xl font-bold text-slate-800">
                          {(sliderValue! > freeTierLimit!
                            ? (sliderValue! - freeTierLimit!) * perMetricCharge
                            : 0
                          ).toFixed(2)}
                        </span>
                        <br />
                        <span className="text-sm font-medium text-slate-400">Month-to-Date</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-slate-800">${monthlyPrice}</span>

                        <span className="text-base font-medium text-slate-400">/ month</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-medium text-slate-400">{actionText}</span>
                    <br />

                    <span className="text-3xl font-bold text-slate-800">${monthlyPrice}</span>

                    <span className="text-base font-medium text-slate-400">/ month</span>
                  </div>
                )}
              </div>
            )}
            {team.billing.features[featureNameKey].status === "inactive" && (
              <Button variant="darkCTA" loading={loading} onClick={() => onUpgrade()}>
                Upgrade {title !== "Link Survey Pro" ? "for free" : "now"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
