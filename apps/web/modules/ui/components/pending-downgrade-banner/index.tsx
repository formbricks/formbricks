"use client";

import { TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TUserLocale } from "@formbricks/types/user";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

interface PendingDowngradeBannerProps {
  organizationId: string;
  // Both derived on the server from the license's `lastChecked` and the grace period, rather than
  // from `Date.now()` here: reading the clock during render is impure, so the banner's copy would
  // differ between the server pass and hydration (ENG-2366).
  isWithinGracePeriod: boolean;
  scheduledDowngradeDate: Date;
  active: boolean;
  isPendingDowngrade: boolean;
  locale: TUserLocale;
  status: TLicenseStatus;
}

export const PendingDowngradeBanner = ({
  organizationId,
  isWithinGracePeriod,
  scheduledDowngradeDate,
  active,
  isPendingDowngrade,
  locale,
  status,
}: Readonly<PendingDowngradeBannerProps>) => {
  const { t } = useTranslation();

  const formattedDate = formatDateForDisplay(scheduledDowngradeDate, locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [show, setShow] = useState(true);

  const isExpired = status === "expired";

  const getDescription = () => {
    if (isExpired) {
      const expiredMessage = t("common.your_license_has_expired_please_renew");
      const downgradedMessage = t("common.you_are_downgraded_to_the_community_edition");
      return `${expiredMessage} ${downgradedMessage}`;
    }

    const unreachableMessage = t(
      "common.we_were_unable_to_verify_your_license_because_the_license_server_is_unreachable"
    );

    if (!active) {
      return `${unreachableMessage} ${t("common.you_are_downgraded_to_the_community_edition")}`;
    }

    if (isWithinGracePeriod) {
      const scheduledMessage = t("common.you_will_be_downgraded_to_the_community_edition_on_date", {
        date: formattedDate,
      });
      return `${unreachableMessage} ${scheduledMessage}`;
    }

    return `${unreachableMessage} ${t("common.you_are_downgraded_to_the_community_edition")}`;
  };

  if (show && (isPendingDowngrade || isExpired)) {
    return (
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-100 flex min-w-80 items-end px-4 py-6 sm:items-start sm:p-6">
        <div className="flex w-full flex-col items-center gap-y-4 sm:items-end">
          <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5 transition">
            <div className="p-4">
              <div className="relative flex flex-col">
                <div className="flex">
                  <div className="shrink-0">
                    <TriangleAlertIcon className="size-6 text-error" aria-hidden="true" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <p className="text-base font-medium text-slate-900">
                      {isExpired ? t("common.license_expired") : t("common.pending_downgrade")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{getDescription()}</p>

                    <Link href={organizationSettingsPath(organizationId, "enterprise")}>
                      <span className="text-sm text-slate-900">{t("common.learn_more")}</span>
                    </Link>
                  </div>
                </div>

                <div className="absolute top-0 right-0 ml-4 flex shrink-0">
                  <button
                    type="button"
                    className="inline-flex rounded-md bg-white text-slate-400 hover:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden"
                    onClick={() => setShow(false)}>
                    <span className="sr-only">{t("common.close")}</span>
                    <XIcon className="size-5" aria-hidden="true" />
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
