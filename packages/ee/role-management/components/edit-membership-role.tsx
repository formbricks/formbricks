"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import type { TMembershipRole } from "@formbricks/types/memberships";
import { Badge } from "@formbricks/ui/Badge";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { transferOwnershipAction, updateInviteAction, updateMembershipAction } from "../lib/actions";
import { TransferOwnershipModal } from "./transfer-ownership-modal";

interface Role {
  isAdminOrOwner: boolean;
  memberRole: TMembershipRole;
  organizationId: string;
  memberId?: string;
  memberName: string;
  userId: string;
  memberAccepted: boolean;
  inviteId?: string;
  currentUserRole: string;
}

export function EditMembershipRole({
  isAdminOrOwner,
  memberRole,
  organizationId,
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
        await updateMembershipAction({ userId: memberId, organizationId, data: { role } });
      }

      if (inviteId) {
        await updateInviteAction({ inviteId: inviteId, organizationId, data: { role } });
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
        await transferOwnershipAction({ organizationId, newOwnerId: memberId });
      }

      setLoading(false);
      setTransferOwnershipModalOpen(false);
      toast.success("Ownership transferred successfully");
      router.refresh();
    } catch (err: any) {
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
    const roles = ["owner", "admin", "editor", "developer", "viewer"];
    if (currentUserRole === "owner" && memberAccepted) {
      return roles;
    }

    return roles.filter((role) => role !== "owner");
  };

  if (isAdminOrOwner) {
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
                  handleRoleChange(value.toLowerCase() as TMembershipRole);
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
        <TransferOwnershipModal
          isLoading={loading}
          memberName={memberName}
          onSubmit={handleOwnershipTransfer}
          open={isTransferOwnershipModalOpen}
          setOpen={setTransferOwnershipModalOpen}
        />
      </>
    );
  }

  return <Badge size="tiny" text={capitalizeFirstLetter(memberRole)} type="gray" />;
}
