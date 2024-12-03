"use client";

import { updateProjectAction } from "@/modules/projects/settings/actions";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslations } from "next-intl";
import { useState } from "react";
import toast from "react-hot-toast";
import { TProjectUpdateInput } from "@formbricks/types/project";

interface EditBrandingProps {
  type: "linkSurvey" | "appSurvey";
  isEnabled: boolean;
  projectId: string;
  isReadOnly?: boolean;
}

export const EditBranding = ({ type, isEnabled, projectId, isReadOnly }: EditBrandingProps) => {
  const t = useTranslations();
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(isEnabled);
  const [updatingBranding, setUpdatingBranding] = useState(false);

  const toggleBranding = async () => {
    try {
      setUpdatingBranding(true);
      const newBrandingState = !isBrandingEnabled;
      setIsBrandingEnabled(newBrandingState);
      let inputProject: Partial<TProjectUpdateInput> = {
        [type === "linkSurvey" ? "linkSurveyBranding" : "inAppSurveyBranding"]: newBrandingState,
      };
      await updateProjectAction({ projectId, data: inputProject });
      toast.success(
        newBrandingState
          ? t("environments.project.look.formbricks_branding_shown")
          : t("environments.project.look.formbricks_branding_hidden")
      );
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUpdatingBranding(false);
    }
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
