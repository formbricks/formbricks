"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectBrandingAction } from "@/modules/ee/whitelabel/remove-branding/actions";
import { TProjectUpdateBrandingInput } from "@/modules/ee/whitelabel/remove-branding/types/project";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import toast from "react-hot-toast";

interface EditBrandingProps {
  type: "linkSurvey" | "appSurvey";
  isEnabled: boolean;
  projectId: string;
  isReadOnly?: boolean;
}

export const EditBranding = ({ type, isEnabled, projectId, isReadOnly }: EditBrandingProps) => {
  const { t } = useTranslate();
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(isEnabled);
  const [updatingBranding, setUpdatingBranding] = useState(false);

  const toggleBranding = async () => {
    setUpdatingBranding(true);
    const newBrandingState = !isBrandingEnabled;
    setIsBrandingEnabled(newBrandingState);

    let inputProject: TProjectUpdateBrandingInput = {
      [type === "linkSurvey" ? "linkSurveyBranding" : "inAppSurveyBranding"]: newBrandingState,
    };
    const updateBrandingResponse = await updateProjectBrandingAction({ projectId, data: inputProject });

    if (updateBrandingResponse?.data) {
      toast.success(
        newBrandingState
          ? t("environments.project.look.formbricks_branding_shown")
          : t("environments.project.look.formbricks_branding_hidden")
      );
    } else {
      const errorMessage = getFormattedErrorMessage(updateBrandingResponse);
      toast.error(errorMessage);
    }
    setUpdatingBranding(false);
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={`branding-${type}`}
        checked={isBrandingEnabled}
        onCheckedChange={toggleBranding}
        disabled={updatingBranding || isReadOnly}
      />
      <Label htmlFor={`branding-${type}`}>
        {t("environments.project.look.show_formbricks_branding_in", {
          type: type === "linkSurvey" ? t("common.link") : t("common.app"),
        })}
      </Label>
    </div>
  );
};
