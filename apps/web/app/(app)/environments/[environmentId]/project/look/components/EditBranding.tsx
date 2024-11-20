"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import toast from "react-hot-toast";
import { TProject, TProjectUpdateInput } from "@formbricks/types/project";
import { Label } from "@formbricks/ui/components/Label";
import { Switch } from "@formbricks/ui/components/Switch";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";
import { updateProjectAction } from "../../actions";

interface EditFormbricksBrandingProps {
  type: "linkSurvey" | "appSurvey";
  project: TProject;
  canRemoveBranding: boolean;
  environmentId: string;
  isReadOnly?: boolean;
}

export const EditFormbricksBranding = ({
  type,
  project: product,
  canRemoveBranding,
  environmentId,
  isReadOnly,
}: EditFormbricksBrandingProps) => {
  const t = useTranslations();
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(
    type === "linkSurvey" ? product.linkSurveyBranding : product.inAppSurveyBranding
  );
  const [updatingBranding, setUpdatingBranding] = useState(false);

  const toggleBranding = async () => {
    try {
      setUpdatingBranding(true);
      const newBrandingState = !isBrandingEnabled;
      setIsBrandingEnabled(newBrandingState);
      let inputProduct: Partial<TProjectUpdateInput> = {
        [type === "linkSurvey" ? "linkSurveyBranding" : "inAppSurveyBranding"]: newBrandingState,
      };
      await updateProjectAction({ projectId: product.id, data: inputProduct });
      toast.success(
        newBrandingState
          ? t("environments.product.look.formbricks_branding_shown")
          : t("environments.product.look.formbricks_branding_hidden")
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
          {t("environments.product.look.show_formbricks_branding_in", {
            type: type === "linkSurvey" ? t("common.link") : t("common.app"),
          })}
        </Label>
      </div>
      {!canRemoveBranding && (
        <div>
          {type === "linkSurvey" && (
            <div className="mb-8">
              <UpgradePlanNotice
                message={t("environments.product.look.formbricks_branding_upgrade_message")}
                textForUrl={t("environments.product.look.formbricks_branding_upgrade_text")}
                url={`/environments/${environmentId}/settings/billing`}
              />
            </div>
          )}
          {type !== "linkSurvey" && (
            <UpgradePlanNotice
              message={t("environments.product.look.formbricks_branding_upgrade_message_in_app")}
              textForUrl={t("environments.product.look.formbricks_branding_upgrade_text")}
              url={`/environments/${environmentId}/settings/billing`}
            />
          )}
        </div>
      )}
    </div>
  );
};