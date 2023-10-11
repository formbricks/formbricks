"use client";

import TransferOwnershipModal from "@/app/(app)/environments/[environmentId]/settings/members/TransferOwnershipModal";
import {
  transferOwnershipAction,
  updateInviteAction,
  updateMembershipAction,
} from "@/app/(app)/environments/[environmentId]/settings/members/actions";
import { MEMBERSHIP_ROLES, capitalizeFirstLetter } from "@/lib/utils";
import { TMembershipRole } from "@formbricks/types/v1/memberships";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Button } from "@formbricks/ui/Button";
import { Badge } from "@formbricks/ui/Badge";
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

    try {
      if (memberAccepted && memberId) {
        await updateMembershipAction(memberId, teamId, { role });
      }

      if (inviteId) {
        await updateInviteAction(inviteId, teamId, { role });
      }
    } catch (error) {
      toast.error("Something went wrong");
    }

    setLoading(false);
    router.refresh();
  };

  const handleOwnershipTransfer = async () => {
    setLoading(true);
    try {
      if (memberId) {
        await transferOwnershipAction(teamId, memberId);
      }

      setLoading(false);
      setTransferOwnershipModalOpen(false);
      toast.success("Ownership transferred successfully");
      router.refresh();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      setLoading(false);
      setTransferOwnershipModalOpen(false);
    }
  };

  const handleRoleChange = (role: TMembershipRole) => {
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

    return Object.keys(MEMBERSHIP_ROLES).filter((role) => role !== "OWNER");
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
                onValueChange={(value) => handleRoleChange(value.toLowerCase() as TMembershipRole)}>
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
