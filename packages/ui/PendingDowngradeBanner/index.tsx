"use client";

import { TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface PendingDowngradeBannerProps {
  lastChecked: Date;
  active: boolean;
  isPendingDowngrade: boolean;
  environmentId: string;
}

export const PendingDowngradeBanner = ({
  lastChecked,
  active,
  isPendingDowngrade,
  environmentId,
}: PendingDowngradeBannerProps) => {
  const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;

  const isLastCheckedWithin72Hours = lastChecked
    ? new Date().getTime() - lastChecked.getTime() < threeDaysInMillis
    : false;

  const scheduledDowngradeDate = new Date(lastChecked.getTime() + threeDaysInMillis);
  const formattedDate = `${scheduledDowngradeDate.getMonth() + 1}/${scheduledDowngradeDate.getDate()}/${scheduledDowngradeDate.getFullYear()}`;

  const [show, setShow] = useState(true);

  if (show && active && isPendingDowngrade) {
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
                    <p className="text-base font-medium text-gray-900">Pending Downgrade</p>
                    <p className="mt-1 text-sm text-gray-500">
                      We were unable to verify your license because the license server is unreachable.{" "}
                      {isLastCheckedWithin72Hours
                        ? `You will be downgraded to the Community Edition on ${formattedDate}.`
                        : "You are downgraded to the Community Edition."}
                    </p>

                    <Link href={`/environments/${environmentId}/settings/enterprise`}>
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
