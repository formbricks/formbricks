"use client";

import {
  createInviteTokenAction,
  deleteInviteAction,
  deleteMembershipAction,
  resendInviteAction,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/actions";
import { ShareInviteModal } from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/components/ShareInviteModal";
import { SendHorizonalIcon, ShareIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TInvite } from "@formbricks/types/invites";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

type MemberActionsProps = {
  organization: TOrganization;
  member?: TMember;
  invite?: TInvite;
  isAdminOrOwner: boolean;
  showDeleteButton?: boolean;
};

export const MemberActions = ({ organization, member, invite, showDeleteButton }: MemberActionsProps) => {
  const router = useRouter();
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);

  const [shareInviteToken, setShareInviteToken] = useState("");

  const handleDeleteMember = async () => {
    try {
      setIsDeleting(true);
      if (!member && invite) {
        // This is an invite

        await deleteInviteAction({ inviteId: invite?.id, organizationId: organization.id });
        toast.success("Invite deleted successfully");
      }

      if (member && !invite) {
        // This is a member

        await deleteMembershipAction({ userId: member.userId, organizationId: organization.id });
        toast.success("Member deleted successfully");
      }

      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      console.log({ err });
      setIsDeleting(false);
      toast.error("Something went wrong");
    }
  };

  const memberName = useMemo(() => {
    if (member) {
      return member.name;
    }

    if (invite) {
      return invite.name;
    }

    return "";
  }, [invite, member]);

  const handleShareInvite = async () => {
    try {
      if (!invite) return;
      const createInviteTokenResponse = await createInviteTokenAction({ inviteId: invite.id });
      if (createInviteTokenResponse?.data) {
        setShareInviteToken(createInviteTokenResponse.data.inviteToken);
        setShowShareInviteModal(true);
      } else {
        const errorMessage = getFormattedErrorMessage(createInviteTokenResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleResendInvite = async () => {
    try {
      if (!invite) return;

      await resendInviteAction({ inviteId: invite.id, organizationId: organization.id });
      toast.success("Invitation sent once more.");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <>
      {showDeleteButton && (
        <button type="button" id="deleteMemberButton" onClick={() => setDeleteMemberModalOpen(true)}>
          <TrashIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
        </button>
      )}

      {invite && (
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  handleShareInvite();
                }}
                className="shareInviteButton">
                <ShareIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="TooltipContent" sideOffset={5}>
              Share Invite Link
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  handleResendInvite();
                }}
                id="resendInviteButton">
                <SendHorizonalIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="TooltipContent" sideOffset={5}>
              Resend Invitation Email
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <DeleteDialog
        open={isDeleteMemberModalOpen}
        setOpen={setDeleteMemberModalOpen}
        deleteWhat={memberName + " from your organization"}
        onDelete={handleDeleteMember}
        isDeleting={isDeleting}
      />

      {showShareInviteModal && (
        <ShareInviteModal
          inviteToken={shareInviteToken}
          open={showShareInviteModal}
          setOpen={setShowShareInviteModal}
        />
      )}
    </>
  );
};
