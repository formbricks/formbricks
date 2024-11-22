"use client";

import {
  createInviteTokenAction,
  deleteInviteAction,
  deleteMembershipAction,
  resendInviteAction,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { ShareInviteModal } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/components/ShareInviteModal";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { SendHorizonalIcon, ShareIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TInvite } from "@formbricks/types/invites";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

type MemberActionsProps = {
  organization: TOrganization;
  member?: TMember;
  invite?: TInvite;
  showDeleteButton?: boolean;
};

export const MemberActions = ({ organization, member, invite, showDeleteButton }: MemberActionsProps) => {
  const router = useRouter();
  const t = useTranslations();
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
        toast.success(t("environments.settings.general.invite_deleted_successfully"));
      }

      if (member && !invite) {
        // This is a member

        await deleteMembershipAction({ userId: member.userId, organizationId: organization.id });
        toast.success(t("environments.settings.general.member_deleted_successfully"));
      }

      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      console.log({ err });
      setIsDeleting(false);
      toast.error(t("common.something_went_wrong_please_try_again"));
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
      toast.error(`${t("common.error")}: ${err.message}`);
    }
  };

  const handleResendInvite = async () => {
    try {
      if (!invite) return;

      await resendInviteAction({ inviteId: invite.id, organizationId: organization.id });
      toast.success(t("environments.settings.general.invitation_sent_once_more"));
    } catch (err) {
      toast.error(`${t("common.error")}: ${err.message}`);
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
              {t("environments.settings.general.share_invite_link")}
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
              {t("environments.settings.general.resend_invitation_email")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <DeleteDialog
        open={isDeleteMemberModalOpen}
        setOpen={setDeleteMemberModalOpen}
        deleteWhat={`${memberName} ${t("environments.settings.general.from_your_organization")}`}
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
