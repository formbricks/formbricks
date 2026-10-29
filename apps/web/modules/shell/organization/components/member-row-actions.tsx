"use client";

import { CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/utils/clipboard";
import {
  createInviteTokenAction,
  leaveOrganizationAction,
} from "@/modules/organization/settings/teams/actions";
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
import { getActionErrorMessage } from "../lib/action-result";
import type { TMemberRowActions } from "../lib/member-rows";

interface MemberRowActionsProps {
  organizationId: string;
  member: { kind: "member" | "invite"; id: string; name: string; email: string };
  actions: TMemberRowActions;
}

/**
 * The two things on the Members page a person still does themselves (ADR 0017): copying an invite link,
 * which is a credential an agent must not handle, and leaving an organization. Everything else about
 * members is the agent's (`update_member_role`, `remove_member`, `resend_invite`, `delete_invite`).
 */
export const MemberRowActions = ({ organizationId, member, actions }: Readonly<MemberRowActionsProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"link" | "leave" | null>(null);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const displayName = member.name || member.email;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setIsConfirmingLeave(false);
      setInviteLink(null);
    }
  };

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
      // Sharing a link refreshes the invite's expiry, which the table shows.
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

  const leave = async () => {
    setBusy("leave");
    try {
      const result = await leaveOrganizationAction({ organizationId });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        toast.error(message);
        return;
      }
      toast.success(t("shell.organization.members.left_organization"));
      // The viewer no longer belongs here, so the page they are on stops existing for them.
      globalThis.location.assign("/");
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setBusy(null);
    }
  };

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
            {actions.canShareLink && (
              <div className="flex flex-col gap-2">
                {inviteLink ? (
                  <>
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
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={createInviteLink}
                    loading={busy === "link"}>
                    {t("shell.organization.members.get_invite_link")}
                  </Button>
                )}
              </div>
            )}

            {isConfirmingLeave && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {t("shell.organization.members.leave_organization_confirmation")}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            {actions.canLeave && !isConfirmingLeave && (
              <Button variant="destructive" onClick={() => setIsConfirmingLeave(true)} className="sm:mr-auto">
                {t("shell.organization.members.leave_organization")}
              </Button>
            )}
            {isConfirmingLeave ? (
              <>
                <Button variant="outline" onClick={() => setIsConfirmingLeave(false)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="destructive" onClick={leave} loading={busy === "leave"}>
                  {t("shell.organization.members.leave_organization")}
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
