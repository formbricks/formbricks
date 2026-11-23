"use client";

import { MoreVertical, SendHorizonalIcon, Settings2Icon, ShareIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { ShareInviteModal } from "@/modules/organization/settings/teams/components/invite-member/share-invite-modal";
import {
  createInviteShareLink,
  deleteInvite,
  deleteMember,
  resendInvite,
} from "@/modules/organization/settings/teams/lib/api-client";
import type { TMemberTableRow } from "@/modules/organization/settings/teams/lib/member-table";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

type TMemberRowMenuProps = Readonly<{
  organizationId: string;
  row: TMemberTableRow;
  canOpenSettings: boolean;
  /** Share link and Resend, for a pending invite the caller may act on. */
  canManageInvite: boolean;
  canDelete: boolean;
  onOpenSettings: () => void;
}>;

/**
 * A Members table row's ⋯ menu (ENG-7474): Member settings first, then Share invite link and Resend
 * invitation email for a pending invite, then Delete. Each item calls the existing invite and membership
 * routes, so their rules are unchanged; items the caller may not use are left out.
 */
export const MemberRowMenu = ({
  organizationId,
  row,
  canOpenSettings,
  canManageInvite,
  canDelete,
  onOpenSettings,
}: TMemberRowMenuProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const invite = row.kind === "invite" ? row.invite : undefined;

  if (!canOpenSettings && !canManageInvite && !canDelete) return null;

  const handleShareInvite = async () => {
    if (!invite) return;
    try {
      const { inviteToken } = await createInviteShareLink(invite.id);
      setShareToken(inviteToken);
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const handleResendInvite = async () => {
    if (!invite) return;
    try {
      await resendInvite({ inviteId: invite.id, organizationId });
      toast.success(t("workspace.settings.general.invitation_sent_once_more"));
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (row.kind === "member" && row.member) {
        await deleteMember({ userId: row.member.userId, organizationId });
      } else if (invite) {
        await deleteInvite(invite.id);
      } else {
        return;
      }
      toast.success(
        row.kind === "member"
          ? t("workspace.settings.general.member_deleted_successfully")
          : t("workspace.settings.general.invite_deleted_successfully")
      );
      setIsDeleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
            aria-label={t("workspace.settings.members.member_actions", { name: row.name || row.email })}
            data-testid="member-row-menu"
            onClick={(event) => event.stopPropagation()}>
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuGroup>
            {canOpenSettings && (
              <DropdownMenuItem icon={<Settings2Icon className="size-4" />} onSelect={onOpenSettings}>
                {t("workspace.settings.members.member_settings")}
              </DropdownMenuItem>
            )}
            {invite && canManageInvite && (
              <>
                <DropdownMenuItem
                  icon={<ShareIcon className="size-4" />}
                  onSelect={() => void handleShareInvite()}>
                  {t("workspace.settings.general.share_invite_link")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<SendHorizonalIcon className="size-4" />}
                  onSelect={() => void handleResendInvite()}>
                  {t("workspace.settings.general.resend_invitation_email")}
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <DropdownMenuItem
                icon={<TrashIcon className="size-4" />}
                onSelect={() => setIsDeleteOpen(true)}>
                {t("common.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The dialogs portal out of the row, but React still bubbles their clicks to it: stop them here. */}
      <div
        className="contents"
        role="presentation"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}>
        <DeleteDialog
          open={isDeleteOpen}
          setOpen={setIsDeleteOpen}
          deleteWhat={t("workspace.settings.general.from_your_organization", {
            memberName: row.name || row.email,
          })}
          onDelete={() => void handleDelete()}
          isDeleting={isDeleting}
          text={t("workspace.settings.general.delete_member_confirmation")}
        />
        {shareToken && (
          <ShareInviteModal
            inviteToken={shareToken}
            open
            setOpen={(open) => {
              if (!open) setShareToken(null);
            }}
          />
        )}
      </div>
    </>
  );
};
