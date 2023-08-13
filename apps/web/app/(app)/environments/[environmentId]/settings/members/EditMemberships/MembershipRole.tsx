"use client";

import TransferOwnershipModal from "@/app/(app)/environments/[environmentId]/settings/members/TransferOwnershipModal";
import {
  updateInviteAction,
  updateMembershipAction,
} from "@/app/(app)/environments/[environmentId]/settings/members/actions";
import { transferOwnership, updateInviteeRole, updateMemberRole, useMembers } from "@/lib/members";
import { MEMBERSHIP_ROLES, capitalizeFirstLetter } from "@/lib/utils";
import { TMembershipRole } from "@formbricks/types/v1/memberships";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@formbricks/ui";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface Role {
  isAdminOrOwner: boolean;
  memberRole: TMembershipRole;
  teamId: string;
  memberId?: string;
  memberName: string;
  environmentId: string;
  userId: string;
  memberAccepted: boolean;
  inviteId?: string;
  currentUserRole: string;
}

export default function MembershipRole({
  isAdminOrOwner,
  memberRole,
  teamId,
  memberId,
  memberName,
  environmentId,
  userId,
  memberAccepted,
  inviteId,
  currentUserRole,
}: Role) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isTransferOwnershipModalOpen, setTransferOwnershipModalOpen] = useState(false);

  const disableRole =
    memberRole && memberId && userId ? memberRole === "owner" || memberId === userId : false;

  const handleMemberRoleUpdate = async (role: TMembershipRole) => {
    setLoading(true);
    if (memberAccepted && memberId) {
      await updateMembershipAction(memberId, teamId, { role });
      return;
    }

    if (inviteId) {
      await updateInviteAction(inviteId, { role });
    }

    setLoading(false);
    router.refresh();
  };

  const handleOwnershipTransfer = async () => {
    setLoading(true);
    const isTransfered = await transferOwnership(teamId, memberId);
    if (isTransfered) {
      toast.success("Ownership transferred successfully");
    } else {
      toast.error("Something went wrong");
    }
    setTransferOwnershipModalOpen(false);
    setLoading(false);
    // mutateTeam();
    router.refresh();
  };

  const handleRoleChange = (role: string) => {
    if (role === "owner") {
      setTransferOwnershipModalOpen(true);
    } else {
      handleMemberRoleUpdate(role);
    }
  };

  const getMembershipRoles = () => {
    if (currentUserRole === "owner" && memberAccepted) {
      return Object.keys(MEMBERSHIP_ROLES);
    }
    return Object.keys(MEMBERSHIP_ROLES).filter((role) => role !== "Owner");
  };

  if (isAdminOrOwner) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={disableRole}
              variant="secondary"
              className="flex items-center gap-1 p-1.5 text-xs"
              loading={loading}
              size="sm">
              <span className="ml-1">{capitalizeFirstLetter(memberRole)}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          {!disableRole && (
            <DropdownMenuContent>
              <DropdownMenuRadioGroup
                value={capitalizeFirstLetter(memberRole)}
                onValueChange={(value) => handleRoleChange(value.toLowerCase())}>
                {getMembershipRoles().map((role) => (
                  <DropdownMenuRadioItem key={role} value={role} className="capitalize">
                    {role.toLowerCase()}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        <TransferOwnershipModal
          open={isTransferOwnershipModalOpen}
          setOpen={setTransferOwnershipModalOpen}
          memberName={memberName}
          onSubmit={handleOwnershipTransfer}
          isLoading={loading}
        />
      </>
    );
  }

  return <Badge text={capitalizeFirstLetter(memberRole)} type="gray" size="tiny" />;
}
