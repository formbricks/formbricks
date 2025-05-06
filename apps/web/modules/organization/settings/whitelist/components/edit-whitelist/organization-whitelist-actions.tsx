"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { addUserToWhitelistAction } from "@/modules/organization/settings/whitelist/actions";
import { AddWhitelistModal } from "@/modules/organization/settings/whitelist/components/add-whitelist/add-whitelist-modal";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface OrganizationWhitelistActionsProps {
  membershipRole?: TOrganizationRole;
  organization: TOrganization;
  isWhitelistDisabled: boolean;
  environmentId: string;
}

export const OrganizationWhitelistActions = ({
  organization,
  membershipRole,
  isWhitelistDisabled,
  environmentId,
}: OrganizationWhitelistActionsProps) => {
  const { t } = useTranslate();
  const [isAddWhitelistModalOpen, setAddWhitelistModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  // TODO: Fix error and success messages for all whitelist components
  const handleAddUserToWhitelist = async (data: { email: string }[]) => {
    if (loading) return;
    setLoading(true);
    if (data.length === 1) {
      const addUserToWhitelistActionResult = await addUserToWhitelistAction({
        organizationId: organization.id,
        email: data[0].email.toLowerCase(),
        role: membershipRole ?? "member",
      });
      if (addUserToWhitelistActionResult?.data) {
        toast.success(t("environments.settings.whitelist.user_successfully_added_to_whitelist"));
      } else {
        const errorMessage = getFormattedErrorMessage(addUserToWhitelistActionResult);
        toast.error(errorMessage);
      }
    }
    setLoading(false);
  };

  return (
    <>
      <div className="mb-4 flex justify-end space-x-2 text-right">
        {!isWhitelistDisabled && isOwnerOrManager && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAddWhitelistModalOpen(true);
            }}>
            {t("environments.settings.whitelist.add_user")}
          </Button>
        )}
      </div>
      <AddWhitelistModal
        open={isAddWhitelistModalOpen}
        setOpen={setAddWhitelistModalOpen}
        onSubmit={handleAddUserToWhitelist}
        membershipRole={membershipRole}
        environmentId={environmentId}
        organizationId={organization.id}
      />
    </>
  );
};
