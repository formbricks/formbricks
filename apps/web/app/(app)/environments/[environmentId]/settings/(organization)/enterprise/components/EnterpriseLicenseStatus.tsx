"use client";

import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { recheckLicenseAction } from "@/modules/ee/license-check/actions";
import { Button } from "@/modules/ui/components/button";

type LicenseStatus = "active" | "expired" | "unreachable" | "no-license";

interface RecheckButtonProps {
  onClick: () => void;
  disabled: boolean;
  recheckingLabel: string;
  recheckLabel: string;
}

const RecheckButton = ({ onClick, disabled, recheckingLabel, recheckLabel }: RecheckButtonProps) => (
  <Button variant="outline" size="sm" onClick={onClick} disabled={disabled} className="bg-white">
    {disabled ? (
      <>
        <RotateCcwIcon className="mr-2 h-4 w-4 animate-spin" />
        {recheckingLabel}
      </>
    ) : (
      <>
        <RotateCcwIcon className="mr-2 h-4 w-4" />
        {recheckLabel}
      </>
    )}
  </Button>
);

interface EnterpriseLicenseStatusProps {
  active: boolean;
  status: LicenseStatus;
  environmentId: string;
}

export const EnterpriseLicenseStatus = ({ active, status, environmentId }: EnterpriseLicenseStatusProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isRechecking, setIsRechecking] = useState(false);

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      const result = await recheckLicenseAction({ environmentId });
      console.log({ result });
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

  const getStatusLabel = () => {
    switch (status) {
      case "active":
        return t("environments.settings.enterprise.license_status_active");
      case "expired":
        return t("environments.settings.enterprise.license_status_expired");
      case "unreachable":
        return t("environments.settings.enterprise.license_status_unreachable");
      case "no-license":
        return t("environments.settings.enterprise.license_status_no_license");
      default:
        return status;
    }
  };

  const isActive = active && status === "active";

  return (
    <div>
      <div className="mt-8 max-w-4xl rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
        <div className="space-y-4 p-8">
          <div className="flex items-center justify-between">
            {isActive ? (
              <div className="flex items-center gap-x-2">
                <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                  <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                </div>
                <p className="text-slate-800">
                  {t(
                    "environments.settings.enterprise.your_enterprise_license_is_active_all_features_unlocked"
                  )}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {t("environments.settings.enterprise.license_status")}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{getStatusLabel()}</p>
              </div>
            )}
            <RecheckButton
              onClick={handleRecheck}
              disabled={isRechecking}
              recheckingLabel={t("environments.settings.enterprise.rechecking")}
              recheckLabel={t("environments.settings.enterprise.recheck_license")}
            />
          </div>
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{t("environments.settings.enterprise.license_status")}:</span>
              <span className="font-medium text-slate-800">{getStatusLabel()}</span>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {t("environments.settings.enterprise.questions_please_reach_out_to")}{" "}
            <a className="font-semibold underline" href="mailto:hola@formbricks.com">
              hola@formbricks.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
