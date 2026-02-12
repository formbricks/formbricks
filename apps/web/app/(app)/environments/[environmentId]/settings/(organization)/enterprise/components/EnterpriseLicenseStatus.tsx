"use client";

import { TFunction } from "i18next";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { recheckLicenseAction } from "@/modules/ee/license-check/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { SettingsCard } from "../../../components/SettingsCard";

type LicenseStatus = "active" | "expired" | "unreachable" | "invalid_license";

interface EnterpriseLicenseStatusProps {
  status: LicenseStatus;
  gracePeriodEnd?: Date;
  environmentId: string;
}

const getBadgeConfig = (
  status: LicenseStatus,
  t: TFunction
): { type: "success" | "error" | "warning" | "gray"; label: string } => {
  switch (status) {
    case "active":
      return { type: "success", label: t("environments.settings.enterprise.license_status_active") };
    case "expired":
      return { type: "error", label: t("environments.settings.enterprise.license_status_expired") };
    case "unreachable":
      return { type: "warning", label: t("environments.settings.enterprise.license_status_unreachable") };
    case "invalid_license":
      return { type: "error", label: t("environments.settings.enterprise.license_status_invalid") };
    default:
      return { type: "gray", label: t("environments.settings.enterprise.license_status") };
  }
};

export const EnterpriseLicenseStatus = ({ status, gracePeriodEnd, environmentId }: EnterpriseLicenseStatusProps) => {
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
        } else if (result.data.status === "invalid_license") {
          toast.error(t("environments.settings.enterprise.recheck_license_invalid"));
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

  const badgeConfig = getBadgeConfig(status, t);

  return (
    <SettingsCard
      title={t("environments.settings.enterprise.license_status")}
      description={t("environments.settings.enterprise.license_status_description")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Badge type={badgeConfig.type} text={badgeConfig.label} size="normal" className="w-fit" />
          </div>
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
        {status === "unreachable" && gracePeriodEnd && (
          <Alert variant="warning" size="small">
            <AlertDescription className="overflow-visible whitespace-normal">
              {t("environments.settings.enterprise.license_unreachable_grace_period", {
                gracePeriodEnd: new Date(gracePeriodEnd).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
              })}
            </AlertDescription>
          </Alert>
        )}
        {status === "invalid_license" && (
          <Alert variant="error" size="small">
            <AlertDescription className="overflow-visible whitespace-normal">
              {t("environments.settings.enterprise.license_invalid_description")}
            </AlertDescription>
          </Alert>
        )}
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
