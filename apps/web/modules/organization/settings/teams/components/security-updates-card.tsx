"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { enrollSecurityUpdatesAction } from "@/modules/organization/settings/teams/actions";
import { TSecurityUpdatesStatus } from "@/modules/organization/settings/teams/lib/security-updates";
import { Button } from "@/modules/ui/components/button";
import { H4, P } from "@/modules/ui/components/typography";

interface SecurityUpdatesCardProps {
  organizationId: string;
  userEmail: string;
  securityUpdatesStatus: TSecurityUpdatesStatus;
}

export const SecurityUpdatesCard = ({
  organizationId,
  userEmail,
  securityUpdatesStatus,
}: SecurityUpdatesCardProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isEnrolling, setIsEnrolling] = useState(false);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      const result = await enrollSecurityUpdatesAction({ organizationId });

      if (result?.data?.success) {
        toast.success(t("environments.settings.teams.security_updates_enrolled_successfully"));
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
      console.error(error);
    } finally {
      setIsEnrolling(false);
    }
  };

  const isEnrolled = securityUpdatesStatus.enrolled;

  return (
    <div
      className={cn(
        "relative my-4 w-full max-w-4xl rounded-xl border bg-white shadow-sm",
        isEnrolled ? "border-green-200 bg-green-50" : "border-slate-200"
      )}>
      <div className="flex items-start justify-between p-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              isEnrolled ? "bg-green-100" : "bg-slate-100"
            )}>
            <ShieldCheckIcon className={cn("h-5 w-5", isEnrolled ? "text-green-600" : "text-slate-600")} />
          </div>
          <div className="flex flex-col gap-1">
            <H4 className="font-medium tracking-normal">
              {t("environments.settings.teams.security_updates_title")}
            </H4>
            <P className="!mt-0 text-sm text-slate-500">
              {isEnrolled
                ? t("environments.settings.teams.security_updates_enrolled_description", {
                    email: securityUpdatesStatus.email || userEmail,
                  })
                : t("environments.settings.teams.security_updates_description")}
            </P>
          </div>
        </div>
        {!isEnrolled && (
          <Button onClick={handleEnroll} disabled={isEnrolling} className="shrink-0">
            {isEnrolling
              ? t("environments.settings.teams.security_updates_enrolling")
              : t("environments.settings.teams.security_updates_enroll")}
          </Button>
        )}
        {isEnrolled && (
          <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700">
              {t("environments.settings.teams.security_updates_enrolled")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
