"use client";

import { useTranslate } from "@tolgee/react";
import { MailIcon } from "lucide-react";
import { TResponseData } from "@formbricks/types/responses";

interface VerifiedAddressProps {
  responseData: TResponseData;
}
export const VerifiedAddress = ({ responseData }: VerifiedAddressProps) => {
  const { t } = useTranslate();
  return (
    <div>
      <p className="flex items-center space-x-2 text-sm text-slate-500">
        <MailIcon className="h-4 w-4" />
        <span>{t("common.verified_address")}</span>
      </p>
      <p className="ph-no-capture my-1 font-semibold text-slate-700">
        {typeof responseData["verifiedAddress"] === "string" ? responseData["verifiedAddress"] : ""}
      </p>
    </div>
  );
};
