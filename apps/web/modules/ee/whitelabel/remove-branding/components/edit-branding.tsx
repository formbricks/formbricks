"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { updateWorkspaceBranding } from "@/modules/ee/whitelabel/remove-branding/lib/api-client";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface EditBrandingProps {
  type: "linkSurvey" | "appSurvey";
  isEnabled: boolean;
  workspaceId: string;
  isReadOnly?: boolean;
}

export const EditBranding = ({ type, isEnabled, workspaceId, isReadOnly }: EditBrandingProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(isEnabled);
  const [updatingBranding, setUpdatingBranding] = useState(false);

  const toggleBranding = async () => {
    setUpdatingBranding(true);
    const newBrandingState = !isBrandingEnabled;
    setIsBrandingEnabled(newBrandingState);

    try {
      await updateWorkspaceBranding({
        workspaceId,
        body:
          type === "linkSurvey"
            ? { linkSurveyBranding: newBrandingState }
            : { inAppSurveyBranding: newBrandingState },
      });
      toast.success(
        newBrandingState
          ? t("workspace.look.formbricks_branding_shown")
          : t("workspace.look.formbricks_branding_hidden")
      );
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
    setUpdatingBranding(false);
  };

  return (
    <div className="flex items-center gap-x-2">
      <Switch
        id={`branding-${type}`}
        checked={isBrandingEnabled}
        onCheckedChange={toggleBranding}
        disabled={updatingBranding || isReadOnly}
      />
      <Label htmlFor={`branding-${type}`}>
        {t("workspace.look.show_formbricks_branding_in", {
          type: type === "linkSurvey" ? t("common.link") : t("common.app"),
        })}
      </Label>
    </div>
  );
};
