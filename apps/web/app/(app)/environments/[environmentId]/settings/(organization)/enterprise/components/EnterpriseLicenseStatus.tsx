"use client";

import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { recheckLicenseAction } from "@/modules/ee/license-check/actions";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { SettingsCard } from "../../../components/SettingsCard";

type LicenseStatus = "active" | "expired" | "unreachable" | "no-license";

interface EnterpriseLicenseStatusProps {
  status: LicenseStatus;
  environmentId: string;
}

const getBadgeConfig = (
  status: LicenseStatus
): { type: "success" | "error" | "warning" | "gray"; labelKey: string } => {
  switch (status) {
    case "active":
      return { type: "success", labelKey: "environments.settings.enterprise.license_status_active" };
    case "expired":
      return { type: "error", labelKey: "environments.settings.enterprise.license_status_expired" };
    case "unreachable":
      return { type: "warning", labelKey: "environments.settings.enterprise.license_status_unreachable" };
    case "no-license":
      return { type: "gray", labelKey: "environments.settings.enterprise.license_status_no_license" };
    default:
      return { type: "gray", labelKey: "environments.settings.enterprise.license_status" };
  }
};

export const EnterpriseLicenseStatus = ({ status, environmentId }: EnterpriseLicenseStatusProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isRechecking, setIsRechecking] = useState(false);

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      const result = await recheckLicenseAction({ environmentId });
      if (result?.serverError) {
        toast.error(result.serverError || t("environments.settings.enterprise.recheck_license_failed"));
        return;
      }

      if (result?.data) {
        if (result.data.status === "unreachable") {
          toast.error(t("environments.settings.enterprise.recheck_license_unreachable"));
        } else {
          toast.success(t("environments.settings.enterprise.recheck_license_success"));
        }
        router.refresh();
      } else {
        toast.error(t("environments.settings.enterprise.recheck_license_failed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("environments.settings.enterprise.recheck_license_failed")
      );
    } finally {
      setIsRechecking(false);
    }
  };

  const badgeConfig = getBadgeConfig(status);

  return (
    <SettingsCard
      title={t("environments.settings.enterprise.license_status")}
      description={t("environments.settings.enterprise.license_status_description")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge type={badgeConfig.type} text={t(badgeConfig.labelKey)} size="normal" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRecheck}
            disabled={isRechecking}
            className="shrink-0">
            {isRechecking ? (
              <>
                <RotateCcwIcon className="mr-2 h-4 w-4 animate-spin" />
                {t("environments.settings.enterprise.rechecking")}
              </>
            ) : (
              <>
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                {t("environments.settings.enterprise.recheck_license")}
              </>
            )}
          </Button>
        </div>
        <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
          {t("environments.settings.enterprise.questions_please_reach_out_to")}{" "}
          <a
            className="font-medium text-slate-700 underline hover:text-slate-900"
            href="mailto:hola@formbricks.com">
            hola@formbricks.com
          </a>
        </p>
      </div>
    </SettingsCard>
  );
};
