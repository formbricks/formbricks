"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

interface RemoveBrandingLicenseTipProps {
  userEmail: string;
  licenseRequestUrl: string;
}

export const RemoveBrandingLicenseTip = ({
  userEmail,
  licenseRequestUrl,
}: Readonly<RemoveBrandingLicenseTipProps>) => {
  const { t } = useTranslation();

  const requestUrl = new URL(licenseRequestUrl);
  requestUrl.searchParams.set("type", "lite");
  if (userEmail) {
    requestUrl.searchParams.set("email", userEmail);
  }

  return (
    <div className="flex w-full flex-col items-center gap-5 px-6 py-8">
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <SparklesIcon className="size-6 text-teal-600" />
      </div>
      <div className="flex max-w-[80%] flex-col items-center gap-2 text-center">
        <h2 className="text-xl font-semibold text-slate-900">
          {t("workspace.look.unlock_remove_branding_with_lite_license")}
        </h2>
        <p className="text-sm text-slate-500">{t("workspace.look.lite_license_description")}</p>
      </div>
      <Button asChild>
        <Link
          href={requestUrl.toString()}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer">
          {t("workspace.look.remove_branding_license_request_cta")}
        </Link>
      </Button>
    </div>
  );
};
