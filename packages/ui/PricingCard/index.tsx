import { CheckIcon } from "lucide-react";

import { TOrganization } from "@formbricks/types/organizations";

import { Badge } from "../Badge";
import { Button } from "../Button";

export const PricingCard = ({
  plan,
  title,
  subtitle,
  monthlyPrice,
  actionText,
  organization,
  paidFeatures,
  loading,
  onUpgrade,
}: {
  plan: string;
  title: string;
  subtitle: string;
  monthlyPrice?: number;
  actionText?: string;
  organization: TOrganization;
  paidFeatures: string[];
  loading: boolean;
  onUpgrade: any;
}) => {
  return (
    <div className="mt-8 rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
      <div className="relative p-8">
        <h2 className="mr-2 inline-flex text-2xl font-bold text-slate-700">{title}</h2>
        {organization.billing.plan === plan && <Badge text="Subscribed" size="normal" type="success" />}
        <p className=" mt-1 whitespace-pre-wrap text-sm text-slate-600">{subtitle}</p>

        <div className={`flex py-3 ${plan === "free" ? "flex-col md:flex-row" : ""}`}>
          <div className={`${plan === "free" ? "w-1/3" : "w-3/5"}`}>
            <ul className="mt-4 space-y-4">
              {plan === "free"
                ? paidFeatures.slice(0, Math.ceil(paidFeatures.length / 3)).map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                        <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                      </div>
                      <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                    </li>
                  ))
                : paidFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                        <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                      </div>
                      <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                    </li>
                  ))}
            </ul>
          </div>
          {plan === "free" && (
            <>
              <div className="w-1/3">
                <ul className="mt-4 space-y-4">
                  {paidFeatures
                    .slice(Math.ceil(paidFeatures.length / 3), 2 * Math.ceil(paidFeatures.length / 3))
                    .map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                          <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                        </div>
                        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="w-1/3">
                <ul className="mt-4 space-y-4">
                  {paidFeatures.slice(2 * Math.ceil(paidFeatures.length / 3)).map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                        <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                      </div>
                      <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="ml-6 flex w-2/5 flex-col items-end space-y-2">
            <div className="my-2">
              {monthlyPrice && actionText && (
                <div>
                  <span className="text-sm font-medium text-slate-400">{actionText}</span>
                  <br />

                  <span className="text-3xl font-bold text-slate-800">€{monthlyPrice}</span>

                  <span className="text-base font-medium text-slate-400">/ month</span>
                </div>
              )}
            </div>

            {organization.billing.plan !== plan && plan !== "enterprise" && plan !== "free" && (
              <Button variant="darkCTA" loading={loading} onClick={() => onUpgrade()}>
                Switch Plan
              </Button>
            )}
            {organization.billing.plan !== plan && plan === "enterprise" && (
              <Button variant="darkCTA" loading={loading} onClick={() => onUpgrade()}>
                Contact Us
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
