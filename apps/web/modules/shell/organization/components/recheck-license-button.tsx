"use client";

import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { recheckLicenseAction } from "@/modules/ee/license-check/actions";
import { Button } from "@/modules/ui/components/button";
import { getActionErrorMessage } from "../lib/action-result";

/** Asks the license server again right now instead of waiting for the daily check. */
export const RecheckLicenseButton = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const recheck = async () => {
    setIsChecking(true);
    try {
      const result = await recheckLicenseAction({ workspaceId });
      const message = getActionErrorMessage(
        result,
        t("workspace.settings.enterprise.recheck_license_failed")
      );
      if (message || !result?.data) {
        toast.error(message ?? t("workspace.settings.enterprise.recheck_license_failed"));
        return;
      }

      switch (result.data.status) {
        case "unreachable":
          toast.error(t("workspace.settings.enterprise.recheck_license_unreachable"));
          break;
        case "instance_mismatch":
          toast.error(t("workspace.settings.enterprise.recheck_license_instance_mismatch"));
          break;
        case "invalid_license":
          toast.error(t("workspace.settings.enterprise.recheck_license_invalid"));
          break;
        default:
          toast.success(t("workspace.settings.enterprise.recheck_license_success"));
      }
      router.refresh();
    } catch {
      toast.error(t("workspace.settings.enterprise.recheck_license_failed"));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Button variant="outline" onClick={recheck} loading={isChecking}>
      <RotateCcwIcon />
      {t("workspace.settings.enterprise.recheck_license")}
    </Button>
  );
};
