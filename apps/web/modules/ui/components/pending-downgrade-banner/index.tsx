"use client";

import { useTranslate } from "@tolgee/react";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TUserLocale } from "@formbricks/types/user";

interface PendingDowngradeBannerProps {
  lastChecked: Date;
  active: boolean;
  isPendingDowngrade: boolean;
  environmentId: string;
  locale: TUserLocale;
}

export const PendingDowngradeBanner = ({
  lastChecked,
  active,
  isPendingDowngrade,
  environmentId,
  locale,
}: PendingDowngradeBannerProps) => {
  const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;
  const { t } = useTranslate();
  const isLastCheckedWithin72Hours = lastChecked
    ? new Date().getTime() - lastChecked.getTime() < threeDaysInMillis
    : false;

  const scheduledDowngradeDate = new Date(lastChecked.getTime() + threeDaysInMillis);
  const formattedDate = scheduledDowngradeDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
                    <p className="text-base font-medium text-slate-900">{t("common.pending_downgrade")}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t(
                        "common.we_were_unable_to_verify_your_license_because_the_license_server_is_unreachable"
                      )}
                      .{" "}
                      {isLastCheckedWithin72Hours
                        ? t("common.you_will_be_downgraded_to_the_community_edition_on_date", {
                            date: formattedDate,
                          })
                        : t("common.you_are_downgraded_to_the_community_edition")}
                    </p>

                    <Link href={`/environments/${environmentId}/settings/enterprise`}>
                      <span className="text-sm text-slate-900">{t("common.learn_more")}</span>
                    </Link>
                  </div>
                </div>

                <div className="absolute right-0 top-0 ml-4 flex flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={() => setShow(false)}>
                    <span className="sr-only">{t("common.close")}</span>
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
