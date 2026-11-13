"use client";

import { SendHorizonalIcon, ShareIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { ShareInviteModal } from "@/modules/organization/settings/teams/components/invite-member/share-invite-modal";
import {
  createInviteShareLink,
  deleteInvite,
  deleteMember,
  resendInvite,
} from "@/modules/organization/settings/teams/lib/api-client";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface MemberActionsProps {
  readonly organization: TOrganization;
  readonly member?: TMember;
  readonly invite?: TInvite;
  readonly showDeleteButton?: boolean;
  /** Share link and Resend, which the server refuses below the user-management floor. */
  readonly canManageInvites: boolean;
}

export const MemberActions = ({
  organization,
  member,
  invite,
  showDeleteButton,
  canManageInvites,
}: MemberActionsProps) => {
  const canActOnInvite = !!invite && canManageInvites;
  const router = useRouter();
  const { t } = useTranslation();
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);
  const [shareInviteToken, setShareInviteToken] = useState("");

  const handleDeleteMember = async () => {
    try {
      setIsDeleting(true);
      if (!member && invite) {
        // This is an invite
        await deleteInvite(invite.id);
        toast.success(t("workspace.settings.general.invite_deleted_successfully"));
      }

      if (member && !invite) {
        // This is a member
        await deleteMember({ userId: member.userId, organizationId: organization.id });
        toast.success(t("workspace.settings.general.member_deleted_successfully"));
      }

      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      setIsDeleting(false);
      toast.error(getV3ApiErrorMessage(err, t("common.something_went_wrong_please_try_again")));
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
      const { inviteToken } = await createInviteShareLink(invite.id);
      setShareInviteToken(inviteToken);
      setShowShareInviteModal(true);
      router.refresh();
    } catch (err) {
      toast.error(getV3ApiErrorMessage(err, t("common.something_went_wrong_please_try_again")));
    }
  };

  const handleResendInvite = async () => {
    try {
      if (!invite) return;

      await resendInvite({ inviteId: invite.id, organizationId: organization.id });
      toast.success(t("workspace.settings.general.invitation_sent_once_more"));
      router.refresh();
    } catch (err) {
      toast.error(getV3ApiErrorMessage(err, t("common.something_went_wrong_please_try_again")));
    }
  };

  return (
    <div className="flex justify-end gap-2">
      <TooltipRenderer tooltipContent={t("common.delete")} shouldRender={!!showDeleteButton}>
        <Button
          variant="destructive"
          size="icon"
          id="deleteMemberButton"
          disabled={!showDeleteButton}
          onClick={() => setDeleteMemberModalOpen(true)}>
          <TrashIcon />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer
        tooltipContent={t("workspace.settings.general.share_invite_link")}
        shouldRender={canActOnInvite}>
        <Button
          variant="secondary"
          size="icon"
          id="shareInviteButton"
          disabled={!canActOnInvite}
          onClick={() => {
            handleShareInvite();
          }}>
          <ShareIcon />
        </Button>
      </TooltipRenderer>

      <TooltipRenderer
        tooltipContent={t("workspace.settings.general.resend_invitation_email")}
        shouldRender={canActOnInvite}>
        <Button
          variant="secondary"
          size="icon"
          id="resendInviteButton"
          disabled={!canActOnInvite}
          onClick={() => {
            handleResendInvite();
          }}>
          <SendHorizonalIcon />
        </Button>
      </TooltipRenderer>

      <DeleteDialog
        open={isDeleteMemberModalOpen}
        setOpen={setDeleteMemberModalOpen}
        deleteWhat={t("workspace.settings.general.from_your_organization", { memberName })}
        onDelete={handleDeleteMember}
        isDeleting={isDeleting}
        text={t("workspace.settings.general.delete_member_confirmation")}
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
