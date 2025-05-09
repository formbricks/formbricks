"use client";

import { getAccessFlags } from "@/lib/membership/utils";
import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { updateInviteAction, updateMembershipAction } from "../actions";

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
  const { t } = useTranslate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { isOwner, isManager } = getAccessFlags(currentUserRole);
  const isOwnerOrManager = isOwner || isManager;

  const disableRole =
    isUserManagementDisabledFromUi ||
    memberId === userId ||
    (memberRole === "owner" && !doesOrgHaveMoreThanOneOwner) ||
    (currentUserRole === "manager" && memberRole === "owner");

  const handleMemberRoleUpdate = async (role: TOrganizationRole) => {
    setLoading(true);

    try {
      if (memberAccepted && memberId) {
        await updateMembershipAction({ userId: memberId, organizationId, data: { role } });
      }

      if (inviteId) {
        await updateInviteAction({ inviteId: inviteId, organizationId, data: { role } });
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setLoading(false);
    router.refresh();
  };

  const handleRoleChange = (role: TOrganizationRole) => {
    handleMemberRoleUpdate(role);
  };

  const getMembershipRoles = () => {
    let roles: string[] = ["member"];

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
            variant="secondary"
            role="button-role">
            <span className="ml-1">{capitalizeFirstLetter(memberRole)}</span>
            <ChevronDownIcon className="h-4 w-4" />
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
                <DropdownMenuRadioItem className="capitalize" key={role} value={role}>
                  {role.toLowerCase()}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  }

  return <Badge size="tiny" type="gray" role="badge-role" text={capitalizeFirstLetter(memberRole)} />;
}
