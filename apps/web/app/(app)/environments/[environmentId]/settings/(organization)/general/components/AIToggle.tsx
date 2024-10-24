"use client";

import { updateOrganizationAIEnabledAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TOrganization } from "@formbricks/types/organizations";
import { Label } from "@formbricks/ui/components/Label";
import { Switch } from "@formbricks/ui/components/Switch";

interface AIToggleProps {
  environmentId: string;
  organization: TOrganization;
  isUserManagerOrOwner: boolean;
}

export const AIToggle = ({ organization, isUserManagerOrOwner }: AIToggleProps) => {
  const [isAIEnabled, setIsAIEnabled] = useState(organization.isAIEnabled);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateOrganization = async (data) => {
    try {
      setIsAIEnabled(data.enabled);
      setIsSubmitting(true);
      const updatedOrganizationResponse = await updateOrganizationAIEnabledAction({
        organizationId: organization.id,
        data: {
          isAIEnabled: data.enabled,
        },
      });

      if (updatedOrganizationResponse?.data) {
        toast.success(`Formbricks AI ${data.enabled ? "enabled" : "disabled"} successfully.`);
      } else {
        const errorMessage = getFormattedErrorMessage(updatedOrganizationResponse);
        toast.error(errorMessage);
      }
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

  return !isUserManagerOrOwner ? (
    <p className="text-sm text-red-700">You are not authorized to perform this action.</p>
  ) : (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="formbricks-ai-toggle" className="cursor-pointer">
          {isAIEnabled ? "Disable" : "Enable"} Formbricks AI
        </Label>
        <Switch
          id="formbricks-ai-toggle"
          disabled={isSubmitting}
          checked={isAIEnabled}
          onClick={(e) => {
            e.stopPropagation();
            handleUpdateOrganization({ enabled: !organization.isAIEnabled });
          }}
        />
      </div>
      <div className="mt-3 text-xs text-slate-600">
        By activating Formbricks AI, you agree to the updated{" "}
        <Link
          className="underline"
          href={"https://formbricks.com/privacy-policy"}
          rel="noreferrer"
          target="_blank">
          Privacy Policy
        </Link>
        .
      </div>
    </div>
  );
};
