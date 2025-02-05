"use client";

import { useTranslate } from "@tolgee/react";
import { MailIcon } from "lucide-react";
import { TResponseData } from "@formbricks/types/responses";

interface VerifiedEmailProps {
  responseData: TResponseData;
}
export const VerifiedEmail = ({ responseData }: VerifiedEmailProps) => {
  const { t } = useTranslate();
  return (
    <div>
      <p className="flex items-center space-x-2 text-sm text-slate-500">
        <MailIcon className="h-4 w-4" />
        <span>{t("common.verified_email")}</span>
      </p>
      <p className="ph-no-capture my-1 font-semibold text-slate-700">
        {typeof responseData["verifiedEmail"] === "string" ? responseData["verifiedEmail"] : ""}
      </p>
    </div>
  );
};
