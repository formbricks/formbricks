"use client";

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
  const orgBillingPeopleLimit = organization.billing?.limits?.monthly?.miu;
  const orgBillingResponseLimit = organization.billing?.limits?.monthly?.responses;

  const isPeopleLimitReached = orgBillingPeopleLimit !== null && peopleCount >= orgBillingPeopleLimit;
  const isResponseLimitReached = orgBillingResponseLimit !== null && responseCount >= orgBillingResponseLimit;

  const [show, setShow] = useState(true);

  if (show && (isPeopleLimitReached || isResponseLimitReached)) {
    return (
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-[100] flex min-w-80 items-end px-4 py-6 sm:items-start sm:p-6">
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition">
            <div className="p-4">
              <div className="relative flex flex-col">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <TriangleAlertIcon className="text-error h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <p className="text-base font-medium text-gray-900">Limits Reached</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {isPeopleLimitReached && isResponseLimitReached ? (
                        <>
                          You have reached your monthly MIU limit of <span>{orgBillingPeopleLimit}</span> and
                          response limit of {orgBillingResponseLimit}.{" "}
                        </>
                      ) : null}
                      {isPeopleLimitReached && !isResponseLimitReached ? (
                        <>You have reached your monthly MIU limit of {orgBillingPeopleLimit}. </>
                      ) : null}
                      {!isPeopleLimitReached && isResponseLimitReached ? (
                        <>You have reached your monthly response limit of {orgBillingResponseLimit}. </>
                      ) : null}
                    </p>
                    <Link href={`/environments/${environmentId}/settings/billing`}>
                      <span className="text-sm text-slate-900">Learn more</span>
                    </Link>
                  </div>
                </div>

                <div className="absolute right-0 top-0 ml-4 flex flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
