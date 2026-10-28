"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { ZUserName } from "@formbricks/types/user";
import { getOrganizationRoleLabels } from "@/lib/membership/utils";
import { inviteUserAction } from "@/modules/organization/settings/teams/actions";
import {
  formatInviteFailureMessage,
  getInviteFailureReasonFromMessage,
} from "@/modules/organization/settings/teams/lib/invite-failure";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
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
import { getActionErrorMessage } from "../lib/action-result";

interface InviteMemberDialogProps {
  organizationId: string;
  /** Roles the viewer may invite as; the first one is the default. */
  inviteRoles: TOrganizationRole[];
  /** Whether teams and roles are licensed. Without it every invite is an owner invite. */
  isAccessControlAllowed: boolean;
  /** Teams the viewer may add people to. */
  teams: { id: string; name: string }[];
  /** A team admin who is not an owner or manager must pick at least one of their teams. */
  isTeamAdminRestricted: boolean;
  upgradeHref: string;
  upgradeIsExternal: boolean;
}

export const InviteMemberDialog = ({
  organizationId,
  inviteRoles,
  isAccessControlAllowed,
  teams,
  isTeamAdminRestricted,
  upgradeHref,
  upgradeIsExternal,
}: Readonly<InviteMemberDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const defaultRole: TOrganizationRole = isAccessControlAllowed ? (inviteRoles[0] ?? "member") : "owner";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TOrganizationRole>(defaultRole);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleLabels = getOrganizationRoleLabels(t);
  const roleDescriptions: Record<TOrganizationRole, string> = {
    owner: t("shell.organization.roles.owner_description"),
    manager: t("shell.organization.roles.manager_description"),
    member: t("shell.organization.roles.member_description"),
    billing: t("shell.organization.roles.billing_description"),
  };

  const reset = () => {
    setName("");
    setEmail("");
    setRole(defaultRole);
    setTeamIds([]);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const toggleTeam = (teamId: string, checked: boolean) =>
    setTeamIds((current) => (checked ? [...current, teamId] : current.filter((id) => id !== teamId)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!ZUserName.safeParse(name).success || !z.email().safeParse(email.trim()).success) {
      setError(t("shell.organization.members.invite_invalid"));
      return;
    }
    if (isTeamAdminRestricted && teamIds.length === 0) {
      setError(t("shell.organization.members.invite_pick_team"));
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await inviteUserAction({
        organizationId,
        email: normalizedEmail,
        name: name.trim(),
        role,
        teamIds: isAccessControlAllowed ? teamIds : [],
      });

      const serverMessage = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (serverMessage) {
        const failureReason = getInviteFailureReasonFromMessage(serverMessage);
        setError(
          failureReason === "unknown"
            ? serverMessage
            : formatInviteFailureMessage(t, { email: normalizedEmail, failureReason })
        );
        return;
      }

      toast.success(t("shell.organization.members.invitation_sent", { email: normalizedEmail }));
      handleOpenChange(false);
      router.refresh();
    } catch {
      setError(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("shell.organization.members.invite_member")}</Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent width="narrow" disableCloseOnOutsideClick closeOnEscape>
          <DialogHeader>
            <DialogTitle className="pr-6">{t("shell.organization.members.invite_member")}</DialogTitle>
            <DialogDescription>{t("shell.organization.members.invite_description")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogBody className="flex flex-col gap-4 px-px py-1">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-name">{t("common.full_name")}</Label>
                <Input
                  id="invite-name"
                  autoComplete="off"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-email">{t("common.email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {!isTeamAdminRestricted && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invite-role">{t("common.role")}</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => setRole(value as TOrganizationRole)}
                    disabled={!isAccessControlAllowed}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(isAccessControlAllowed ? inviteRoles : (["owner"] as TOrganizationRole[])).map(
                        (inviteRole) => (
                          <SelectItem key={inviteRole} value={inviteRole}>
                            {roleLabels[inviteRole]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">{roleDescriptions[role]}</p>
                </div>
              )}

              {isAccessControlAllowed && teams.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium text-slate-800">
                    {t("shell.organization.members.add_to_teams")}
                  </legend>
                  <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`invite-team-${team.id}`}
                          checked={teamIds.includes(team.id)}
                          onCheckedChange={(checked) => toggleTeam(team.id, checked === true)}
                        />
                        <Label htmlFor={`invite-team-${team.id}`} className="font-normal">
                          {team.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}

              {!isAccessControlAllowed && (
                <Alert variant="info" role="status">
                  <AlertDescription>
                    {t("shell.organization.members.roles_need_license")}{" "}
                    <a
                      className="font-medium underline"
                      href={upgradeHref}
                      {...(upgradeIsExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {t("common.upgrade_plan")}
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {t("common.invite")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
