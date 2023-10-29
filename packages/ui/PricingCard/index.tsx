import { TTeam } from "@formbricks/types/teams";
import { CheckIcon } from "@heroicons/react/24/outline";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Slider } from "../Slider";

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
  onUbsubscribe,
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
  paidFeatures: string[];
  perMetricCharge?: number;
  loading: boolean;
  onUpgrade: any;
  onUbsubscribe: any;
}) => {
  const currentDate = new Date();
  const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const daysPassed = currentDate.getDate();

  const featureNameKey = featureName as keyof typeof team.billing.features;
  return (
    <div className="mt-8 rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
      <div className="relative p-8">
        <h2 className="mr-2 inline-flex text-2xl font-bold text-slate-700">{title}</h2>
        {team.billing.features[featureNameKey].status === "active" ? (
          <>
            <Badge text="Subscribed" size="normal" type="success" />
            <Button
              variant="secondary"
              onClick={(e) => onUbsubscribe(e)}
              className="absolute right-12 top-10">
              Unsubscribe
            </Button>
          </>
        ) : team.billing.features[featureNameKey].status === "canceled" ? (
          <Badge text="Cancelling at End of this Month" size="normal" type="warning" />
        ) : null}

        <p className=" whitespace-pre-wrap text-sm text-slate-600">{subtitle}</p>

        {metric && perMetricCharge && (
          <div className="rounded-xl bg-slate-100 py-4 dark:bg-slate-800">
            <div className="rounded-xl">
              <div className="mb-2 flex items-center gap-x-4"></div>
              <div className="relative my-2">
                <Slider
                  className="slider-class"
                  value={sliderValue || 0}
                  max={sliderLimit || 100}
                  freeTierLimit={freeTierLimit || 0}
                  metric={metric}
                />
              </div>
              <hr className="mt-12" />
            </div>
          </div>
        )}

        <div className="flex py-3">
          <div className="w-3/5">
            {team.billing.features[featureNameKey].status === "inactive" && (
              <p className=" whitespace-pre-wrap text-sm text-slate-600">
                You&apos;re on the <b>Free plan</b> in {title}.<br />
                Upgrade now to unlock the below features:
              </p>
            )}

            <ul className="mt-4 space-y-4">
              {paidFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                    <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                  </div>
                  <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-1/5"></div>
          <div className="w-1/5">
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
            {team.billing.features[featureNameKey].status === "inactive" && (
              <Button
                variant="darkCTA"
                className="w-full justify-center py-2 text-white shadow-sm"
                loading={loading}
                onClick={() => onUpgrade()}>
                Upgrade
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
