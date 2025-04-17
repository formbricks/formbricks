"use client";

import { useTranslate } from "@tolgee/react";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TOrganization } from "@formbricks/types/organizations";

interface LimitsReachedBannerProps {
  organization: TOrganization;
  environmentId: string;
  peopleCount: number;
  responseCount: number;
}

export const LimitsReachedBanner = ({
  organization,
  peopleCount,
  responseCount,
  environmentId,
}: LimitsReachedBannerProps) => {
  const { t } = useTranslate();
  const orgBillingPeopleLimit = organization.billing?.limits?.monthly?.miu;
  const orgBillingResponseLimit = organization.billing?.limits?.monthly?.responses;

  const isPeopleLimitReached = orgBillingPeopleLimit !== null && peopleCount >= orgBillingPeopleLimit;
  const isResponseLimitReached = orgBillingResponseLimit !== null && responseCount >= orgBillingResponseLimit;

  const [show, setShow] = useState(true);

  if (show && (isPeopleLimitReached || isResponseLimitReached)) {
    return (
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-100 flex min-w-80 items-end px-4 py-6 sm:items-start sm:p-6">
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          <div className="ring-opacity-5 pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black transition">
            <div className="p-4">
              <div className="relative flex flex-col">
                <div className="flex">
                  <div className="shrink-0">
                    <TriangleAlertIcon className="text-error h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <p className="text-base font-medium text-slate-900">{t("common.limits_reached")}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isPeopleLimitReached && isResponseLimitReached ? (
                        <>
                          {t("common.you_have_reached_your_monthly_miu_limit_of")}{" "}
                          <span>{orgBillingPeopleLimit}</span> {t("common.and_response_limit_of")}{" "}
                          {orgBillingResponseLimit}.{" "}
                        </>
                      ) : null}
                      {isPeopleLimitReached && !isResponseLimitReached ? (
                        <>
                          {t("common.you_have_reached_your_monthly_miu_limit_of")} {orgBillingPeopleLimit}
                          .{" "}
                        </>
                      ) : null}
                      {!isPeopleLimitReached && isResponseLimitReached ? (
                        <>
                          {t("common.you_have_reached_your_monthly_response_limit_of")}{" "}
                          {orgBillingResponseLimit}.{" "}
                        </>
                      ) : null}
                    </p>
                    <Link href={`/environments/${environmentId}/settings/billing`}>
                      <span className="text-sm text-slate-900">{t("common.learn_more")}</span>
                    </Link>
                  </div>
                </div>

                <div className="absolute top-0 right-0 ml-4 flex shrink-0">
                  <button
                    type="button"
                    className="inline-flex rounded-md bg-white text-slate-400 hover:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden"
                    onClick={() => setShow(false)}>
                    <span className="sr-only">Close</span>
                    <XIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
