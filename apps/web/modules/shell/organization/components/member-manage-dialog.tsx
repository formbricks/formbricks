"use client";

import { CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getOrganizationRoleLabels } from "@/lib/membership/utils";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { updateInviteAction, updateMembershipAction } from "@/modules/ee/role-management/actions";
import {
  createInviteTokenAction,
  deleteInviteAction,
  deleteMembershipAction,
  leaveOrganizationAction,
  resendInviteAction,
} from "@/modules/organization/settings/teams/actions";
import { reactivateMember } from "@/modules/organization/settings/teams/lib/reactivate-member-client";
import { getReactivateMemberErrorMessage } from "@/modules/organization/settings/teams/lib/reactivate-member-error";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { type TActionResult, getActionErrorMessage } from "../lib/action-result";
import type { TMemberRowAccess } from "../lib/member-rows";

export interface TManagedMember {
  kind: "member" | "invite";
  id: string;
  name: string;
  email: string;
  role: TOrganizationRole;
}

interface MemberManageDialogProps {
  organizationId: string;
  member: TManagedMember;
  access: TMemberRowAccess;
}

export const MemberManageDialog = ({ organizationId, member, access }: Readonly<MemberManageDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const isInvite = member.kind === "invite";
  const roleLabels = getOrganizationRoleLabels(t);
  const displayName = member.name || member.email;
  const canChangeRole = access.assignableRoles.length > 0;
  // The role the viewer may not hand out (a manager looking at an owner) still has to show as selected.
  const roleOptions = access.assignableRoles.includes(member.role)
    ? access.assignableRoles
    : [member.role, ...access.assignableRoles];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setIsConfirmingRemoval(false);
      setInviteLink(null);
    }
  };

  /** Runs one action; on success shows `successMessage` and re-renders the page. Returns whether it went through. */
  const run = async (
    key: string,
    action: () => Promise<TActionResult>,
    successMessage: string
  ): Promise<boolean> => {
    setBusy(key);
    try {
      const result = await action();
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        toast.error(message);
        return false;
      }
      toast.success(successMessage);
      router.refresh();
      return true;
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const changeRole = (role: string) => {
    const nextRole = role as TOrganizationRole;
    if (nextRole === member.role) return;
    void run(
      "role",
      () =>
        isInvite
          ? updateInviteAction({ inviteId: member.id, data: { role: nextRole } })
          : updateMembershipAction({ userId: member.id, organizationId, data: { role: nextRole } }),
      t("shell.organization.members.role_updated")
    );
  };

  const resend = () =>
    void run(
      "resend",
      () => resendInviteAction({ inviteId: member.id, organizationId }),
      t("shell.organization.members.invitation_resent")
    );

  const createInviteLink = async () => {
    setBusy("link");
    try {
      const result = await createInviteTokenAction({ inviteId: member.id });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message || !result?.data) {
        toast.error(message ?? t("common.something_went_wrong_please_try_again"));
        return;
      }
      setInviteLink(`${globalThis.location.origin}/invite?token=${result.data.inviteToken}`);
      router.refresh();
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    const copied = await copyToClipboard(inviteLink);
    if (copied) {
      toast.success(t("common.copied_to_clipboard"));
    } else {
      toast.error(t("common.failed_to_copy_to_clipboard"));
    }
  };

  const reactivate = async () => {
    setBusy("reactivate");
    try {
      await reactivateMember({ userId: member.id, organizationId });
      toast.success(t("shell.organization.members.member_reactivated", { name: displayName }));
      router.refresh();
    } catch (error) {
      toast.error(getReactivateMemberErrorMessage(error, t));
    } finally {
      setBusy(null);
    }
  };

  const removeOrLeave = async () => {
    let succeeded: boolean;
    if (access.canLeave) {
      succeeded = await run(
        "remove",
        () => leaveOrganizationAction({ organizationId }),
        t("shell.organization.members.left_organization")
      );
      // The viewer no longer belongs here, so the page they are on stops existing for them.
      if (succeeded) globalThis.location.assign("/");
      return;
    }

    succeeded = await run(
      "remove",
      () =>
        isInvite
          ? deleteInviteAction({ inviteId: member.id })
          : deleteMembershipAction({ userId: member.id, organizationId }),
      isInvite
        ? t("shell.organization.members.invitation_deleted")
        : t("shell.organization.members.member_removed")
    );
    if (succeeded) handleOpenChange(false);
  };

  let removeLabel = t("shell.organization.members.remove_member");
  let confirmText = t("shell.organization.members.remove_member_confirmation", { name: displayName });
  if (access.canLeave) {
    removeLabel = t("shell.organization.members.leave_organization");
    confirmText = t("shell.organization.members.leave_organization_confirmation");
  } else if (isInvite) {
    removeLabel = t("shell.organization.members.delete_invitation");
    confirmText = t("shell.organization.members.delete_invitation_confirmation", { email: member.email });
  }

  const canRemoveOrLeave = access.canRemove || access.canLeave;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("common.manage")}
        <span className="sr-only">{displayName}</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle className="pr-6">{displayName}</DialogTitle>
            <DialogDescription>{member.email}</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`member-role-${member.id}`}>{t("common.role")}</Label>
              <Select
                value={member.role}
                onValueChange={changeRole}
                disabled={!canChangeRole || busy === "role"}>
                <SelectTrigger id={`member-role-${member.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role} disabled={!access.assignableRoles.includes(role)}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeRole && (
                <p className="text-xs text-slate-500">{t("shell.organization.members.role_locked")}</p>
              )}
            </div>

            {(access.canResend || access.canShareLink || access.canReactivate) && (
              <div className="flex flex-wrap gap-2">
                {access.canResend && (
                  <Button variant="outline" size="sm" onClick={resend} loading={busy === "resend"}>
                    {t("shell.organization.members.resend_invitation")}
                  </Button>
                )}
                {access.canShareLink && (
                  <Button variant="outline" size="sm" onClick={createInviteLink} loading={busy === "link"}>
                    {t("shell.organization.members.get_invite_link")}
                  </Button>
                )}
                {access.canReactivate && (
                  <Button variant="outline" size="sm" onClick={reactivate} loading={busy === "reactivate"}>
                    {t("shell.organization.members.reactivate")}
                  </Button>
                )}
              </div>
            )}

            {inviteLink && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`invite-link-${member.id}`}>
                  {t("shell.organization.members.invite_link")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input id={`invite-link-${member.id}`} readOnly value={inviteLink} />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyInviteLink}
                    aria-label={t("common.copy_link")}>
                    <CopyIcon />
                  </Button>
                </div>
              </div>
            )}

            {isConfirmingRemoval && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {confirmText}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            {canRemoveOrLeave && !isConfirmingRemoval && (
              <Button
                variant="destructive"
                onClick={() => setIsConfirmingRemoval(true)}
                className="sm:mr-auto">
                {removeLabel}
              </Button>
            )}
            {isConfirmingRemoval ? (
              <>
                <Button variant="outline" onClick={() => setIsConfirmingRemoval(false)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="destructive" onClick={removeOrLeave} loading={busy === "remove"}>
                  {removeLabel}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.close")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
