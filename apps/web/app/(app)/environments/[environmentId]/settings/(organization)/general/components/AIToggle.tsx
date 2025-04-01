"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { TOrganization } from "@formbricks/types/organizations";

interface AIToggleProps {
  environmentId: string;
  organization: TOrganization;
  isOwnerOrManager: boolean;
}

export const AIToggle = ({ organization, isOwnerOrManager }: AIToggleProps) => {
  const { t } = useTranslate();
  const [isAIEnabled, setIsAIEnabled] = useState(organization.isAIEnabled);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateOrganization = async (data) => {
    try {
      setIsAIEnabled(data.enabled);
      setIsSubmitting(true);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="formbricks-ai-toggle" className="cursor-pointer">
            {t("environments.settings.general.enable_formbricks_ai")}
          </Label>
          <Switch
            id="formbricks-ai-toggle"
            disabled={!isOwnerOrManager || isSubmitting}
            checked={isAIEnabled}
            onClick={(e) => {
              e.stopPropagation();
              handleUpdateOrganization({ enabled: !organization.isAIEnabled });
            }}
          />
        </div>
        <div className="mt-3 text-xs text-slate-600">
          {t("environments.settings.general.formbricks_ai_privacy_policy_text")}{" "}
          <Link
            className="underline"
            href={"https://formbricks.com/privacy-policy"}
            rel="noreferrer"
            target="_blank">
            {t("common.privacy_policy")}
          </Link>
          .
        </div>
      </div>
      {!isOwnerOrManager && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("environments.settings.general.only_org_owner_can_perform_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
