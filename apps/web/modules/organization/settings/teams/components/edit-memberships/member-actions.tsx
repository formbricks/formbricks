"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createInviteTokenAction,
  deleteInviteAction,
  deleteMembershipAction,
  resendInviteAction,
} from "@/modules/organization/settings/teams/actions";
import { ShareInviteModal } from "@/modules/organization/settings/teams/components/invite-member/share-invite-modal";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { SendHorizonalIcon, ShareIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface MemberActionsProps {
  organization: TOrganization;
  member?: TMember;
  invite?: TInvite;
  showDeleteButton?: boolean;
}

export const MemberActions = ({ organization, member, invite, showDeleteButton }: MemberActionsProps) => {
  const router = useRouter();
  const { t } = useTranslate();
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

      const resendInviteResponse = await resendInviteAction({
        inviteId: invite.id,
        organizationId: organization.id,
      });
      if (resendInviteResponse?.data) {
        toast.success(t("environments.settings.general.invitation_sent_once_more"));
      } else {
        const errorMessage = getFormattedErrorMessage(resendInviteResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`${t("common.error")}: ${err.message}`);
    }
  };

  return (
    <div className="flex gap-2">
      {showDeleteButton && (
        <>
          <TooltipRenderer tooltipContent={t("common.delete")}>
            <Button
              variant="secondary"
              size="icon"
              id="deleteMemberButton"
              onClick={() => setDeleteMemberModalOpen(true)}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        </>
      )}

      {invite && (
        <>
          <TooltipRenderer tooltipContent={t("environments.settings.general.share_invite_link")}>
            <Button
              variant="secondary"
              size="icon"
              id="shareInviteButton"
              onClick={() => {
                handleShareInvite();
              }}>
              <ShareIcon />
            </Button>
          </TooltipRenderer>

          <TooltipRenderer tooltipContent={t("environments.settings.general.resend_invitation_email")}>
            <Button
              variant="secondary"
              size="icon"
              id="resendInviteButton"
              onClick={() => {
                handleResendInvite();
              }}>
              <SendHorizonalIcon />
            </Button>
          </TooltipRenderer>
        </>
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
    </div>
  );
};
