"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { Badge } from "@formbricks/ui/components/Badge";
import { Button } from "@formbricks/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";
import {
  //  transferOwnershipAction,
  updateInviteAction,
  updateMembershipAction,
} from "../actions";

// import { TransferOwnershipModal } from "./transfer-ownership-modal";

interface Role {
  isUserManagerOrOwner: boolean;
  memberRole: TOrganizationRole;
  organizationId: string;
  memberId?: string;
  // memberName: string;
  userId: string;
  memberAccepted?: boolean;
  inviteId?: string;
  currentUserRole: string;
  doesOrgHaveMoreThanOneOwner?: boolean;
}

export function EditMembershipRole({
  isUserManagerOrOwner,
  memberRole,
  organizationId,
  memberId,
  // memberName,
  userId,
  memberAccepted,
  inviteId,
  currentUserRole,
  doesOrgHaveMoreThanOneOwner,
}: Role) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // const [isTransferOwnershipModalOpen, setTransferOwnershipModalOpen] = useState(false);

  const disableRole = memberId === userId || (memberRole === "owner" && !doesOrgHaveMoreThanOneOwner);

  const handleMemberRoleUpdate = async (organizationRole: TOrganizationRole) => {
    setLoading(true);

    try {
      if (memberAccepted && memberId) {
        await updateMembershipAction({ userId: memberId, organizationId, data: { organizationRole } });
      }

      if (inviteId) {
        await updateInviteAction({ inviteId: inviteId, organizationId, data: { organizationRole } });
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
    const roles = ["owner", "manager", "member", "billing"];
    if (currentUserRole === "owner" && memberAccepted) {
      return roles;
    }

    return roles.filter((role) => role !== "owner");
  };

  if (isUserManagerOrOwner) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="flex items-center gap-1 p-2 text-xs"
              disabled={disableRole}
              loading={loading}
              size="sm"
              variant="secondary">
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
                value={capitalizeFirstLetter(memberRole)}>
                {getMembershipRoles().map((role) => (
                  <DropdownMenuRadioItem className="capitalize" key={role} value={role}>
                    {role.toLowerCase()}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        {/* <TransferOwnershipModal
          isLoading={loading}
          memberName={memberName}
          onSubmit={handleOwnershipTransfer}
          open={isTransferOwnershipModalOpen}
          setOpen={setTransferOwnershipModalOpen}
        /> */}
      </>
    );
  }

  return <Badge size="tiny" text={capitalizeFirstLetter(memberRole)} type="gray" />;
}