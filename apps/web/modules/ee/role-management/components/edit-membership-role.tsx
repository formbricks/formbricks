"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags, getOrganizationRoleLabels } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { updateInviteRole, updateMemberRole } from "@/modules/ee/role-management/lib/api-client";
import { isRoleEditDisabled } from "@/modules/ee/role-management/lib/role-edit-rules";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface Role {
  currentUserRole: TOrganizationRole;
  memberRole: TOrganizationRole;
  organizationId: string;
  memberId?: string;
  userId: string;
  memberAccepted?: boolean;
  inviteId?: string;
  doesOrgHaveMoreThanOneOwner?: boolean;
  isFormbricksCloud: boolean;
  isUserManagementDisabledFromUi: boolean;
}

export function EditMembershipRole({
  memberRole,
  organizationId,
  currentUserRole,
  memberId,
  userId,
  memberAccepted,
  inviteId,
  doesOrgHaveMoreThanOneOwner,
  isFormbricksCloud,
  isUserManagementDisabledFromUi,
}: Role) {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const roleLabels = getOrganizationRoleLabels(t);
  const { isOwner, isManager } = getAccessFlags(currentUserRole);
  const isOwnerOrManager = isOwner || isManager;

  const disableRole = isRoleEditDisabled({
    isUserManagementDisabledFromUi,
    currentUserRole,
    memberRole,
    memberId,
    userId,
    memberAccepted,
    doesOrgHaveMoreThanOneOwner,
  });

  const handleMemberRoleUpdate = async (role: TOrganizationRole) => {
    setLoading(true);

    try {
      if (memberAccepted && memberId) {
        await updateMemberRole({ userId: memberId, organizationId, body: { role } });
      }

      if (inviteId) {
        await updateInviteRole({ inviteId, body: { role } });
      }
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  };

  const handleRoleChange = (role: TOrganizationRole) => {
    handleMemberRoleUpdate(role);
  };

  const getMembershipRoles = () => {
    const roles: TOrganizationRole[] = ["member"];

    if (isOwner) {
      roles.push("manager", "owner");

      if (isFormbricksCloud) {
        roles.push("billing");
      }
    }
    return roles;
  };

  if (isOwnerOrManager) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="flex items-center gap-1 p-2 text-xs"
            disabled={disableRole}
            loading={loading}
            size="sm"
            variant="secondary">
            <span className="ml-1">{roleLabels[memberRole]}</span>
            <ChevronDownIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        {!disableRole && (
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                handleRoleChange(value.toLowerCase() as TOrganizationRole);
              }}
              value={memberRole}
              className="flex flex-col-reverse">
              {getMembershipRoles().map((role) => (
                <DropdownMenuRadioItem key={role} value={role}>
                  {roleLabels[role]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  }

  return <Badge size="tiny" type="gray" text={roleLabels[memberRole]} />;
}
