"use client";

import { updateProjectAction } from "@/modules/projects/settings/actions";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { UpgradePlanNotice } from "@/modules/ui/components/upgrade-plan-notice";
import { useTranslations } from "next-intl";
import { useState } from "react";
import toast from "react-hot-toast";
import { TProject, TProjectUpdateInput } from "@formbricks/types/project";

interface EditBrandingProps {
  type: "linkSurvey" | "appSurvey";
  project: TProject;
  canRemoveBranding: boolean;
  environmentId: string;
  isReadOnly?: boolean;
}

export const EditBranding = ({
  type,
  project,
  canRemoveBranding,
  environmentId,
  isReadOnly,
}: EditBrandingProps) => {
  const t = useTranslations();
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(
    type === "linkSurvey" ? project.linkSurveyBranding : project.inAppSurveyBranding
  );
  const [updatingBranding, setUpdatingBranding] = useState(false);

  const toggleBranding = async () => {
    try {
      setUpdatingBranding(true);
      const newBrandingState = !isBrandingEnabled;
      setIsBrandingEnabled(newBrandingState);
      let inputProject: Partial<TProjectUpdateInput> = {
        [type === "linkSurvey" ? "linkSurveyBranding" : "inAppSurveyBranding"]: newBrandingState,
      };
      await updateProjectAction({ projectId: project.id, data: inputProject });
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
    <div className="w-full items-center space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id={`branding-${type}`}
          checked={isBrandingEnabled}
          onCheckedChange={toggleBranding}
          disabled={!canRemoveBranding || updatingBranding || isReadOnly}
        />
        <Label htmlFor={`branding-${type}`}>
          {t("environments.project.look.show_formbricks_branding_in", {
            type: type === "linkSurvey" ? t("common.link") : t("common.app"),
          })}
        </Label>
      </div>
      {!canRemoveBranding && (
        <div>
          {type === "linkSurvey" && (
            <div className="mb-8">
              <UpgradePlanNotice
                message={t("environments.project.look.formbricks_branding_upgrade_message")}
                textForUrl={t("environments.project.look.formbricks_branding_upgrade_text")}
                url={`/environments/${environmentId}/settings/billing`}
              />
            </div>
          )}
          {type !== "linkSurvey" && (
            <UpgradePlanNotice
              message={t("environments.project.look.formbricks_branding_upgrade_message_in_app")}
              textForUrl={t("environments.project.look.formbricks_branding_upgrade_text")}
              url={`/environments/${environmentId}/settings/billing`}
            />
          )}
        </div>
      )}
    </div>
  );
};
