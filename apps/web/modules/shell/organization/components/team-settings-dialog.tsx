"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  deleteTeamAction,
  getTeamDetailsAction,
  updateTeamDetailsAction,
} from "@/modules/ee/teams/team-list/actions";
import {
  type TOrganizationMember,
  type TTeamDetails,
  type TTeamRole,
  ZTeamRole,
  ZTeamSettingsFormSchema,
} from "@/modules/ee/teams/team-list/types/team";
import type { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { type TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
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
import { IdBadge } from "@/modules/ui/components/id-badge";
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

interface TMemberDraft {
  userId: string;
  role: TTeamRole;
}

interface TWorkspaceDraft {
  workspaceId: string;
  permission: TTeamPermission;
}

interface TeamSettingsDialogProps {
  teamId: string;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgMembers: TOrganizationMember[];
  orgWorkspaces: TOrganizationWorkspace[];
  isOwnerOrManager: boolean;
  /** The viewer's own role in this team, `null` when they are not in it. */
  viewerTeamRole: TTeamRole | null;
  currentUserId: string;
}

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: "base" });

/**
 * Loads the team's members and workspace access when the dialog opens, then hands them to the form. The
 * caller mounts one dialog per managed team (`key` the team id), so its state always starts empty.
 */
export const TeamSettingsDialog = ({
  open,
  onOpenChange,
  teamName,
  ...formProps
}: Readonly<TeamSettingsDialogProps>) => {
  const { t } = useTranslation();
  const { teamId } = formProps;
  const [details, setDetails] = useState<TTeamDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let isStale = false;

    getTeamDetailsAction({ teamId })
      .then((result) => {
        if (isStale) return;
        const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
        if (message || !result?.data) {
          setLoadError(message ?? t("common.something_went_wrong_please_try_again"));
          return;
        }
        setDetails(result.data);
      })
      .catch(() => {
        if (!isStale) setLoadError(t("common.something_went_wrong_please_try_again"));
      });

    return () => {
      isStale = true;
    };
  }, [open, teamId, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">
            {t("shell.organization.teams.settings_title", { name: teamName })}
          </DialogTitle>
          <DialogDescription>{t("shell.organization.teams.settings_description")}</DialogDescription>
        </DialogHeader>
        {loadError && (
          <p role="alert" className="text-sm text-red-700">
            {loadError}
          </p>
        )}
        {!details && !loadError && (
          <p className="py-8 text-center text-sm text-slate-500">{t("shell.organization.teams.loading")}</p>
        )}
        {details && (
          <TeamSettingsForm
            key={details.id}
            details={details}
            onClose={() => onOpenChange(false)}
            {...formProps}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const TeamSettingsForm = ({
  details,
  onClose,
  orgMembers,
  orgWorkspaces,
  isOwnerOrManager,
  viewerTeamRole,
  currentUserId,
}: Readonly<
  Omit<TeamSettingsDialogProps, "open" | "onOpenChange" | "teamName"> & {
    details: TTeamDetails;
    onClose: () => void;
  }
>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const isTeamAdminMember = !isOwnerOrManager && viewerTeamRole === "admin";
  const canEditMembers = isOwnerOrManager || isTeamAdminMember;
  const canEditWorkspaces = isOwnerOrManager;

  const [name, setName] = useState(details.name);
  const [members, setMembers] = useState<TMemberDraft[]>(
    details.members.length
      ? details.members.map(({ userId, role }) => ({ userId, role }))
      : [{ userId: "", role: ZTeamRole.enum.contributor }]
  );
  const [workspaces, setWorkspaces] = useState<TWorkspaceDraft[]>(
    details.workspaces.length
      ? details.workspaces.map(({ workspaceId, permission }) => ({ workspaceId, permission }))
      : [{ workspaceId: "", permission: ZTeamPermission.enum.read }]
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const existingMemberIds = new Set(details.members.map((member) => member.userId));
  const existingWorkspaceIds = new Set(details.workspaces.map((workspace) => workspace.workspaceId));
  const memberById = new Map(orgMembers.map((member) => [member.id, member]));

  const memberOptions = (index: number) =>
    orgMembers
      .filter(
        (member) => member.id === members[index]?.userId || !members.some((m) => m.userId === member.id)
      )
      .map((member) => ({ value: member.id, label: member.name }))
      .sort(byLabel);

  const workspaceOptions = (index: number) =>
    orgWorkspaces
      .filter(
        (workspace) =>
          workspace.id === workspaces[index]?.workspaceId ||
          !workspaces.some((w) => w.workspaceId === workspace.id)
      )
      .map((workspace) => ({ value: workspace.id, label: workspace.name }))
      .sort(byLabel);

  const patchMember = (index: number, patch: Partial<TMemberDraft>) =>
    setMembers((current) => current.map((member, i) => (i === index ? { ...member, ...patch } : member)));

  const patchWorkspace = (index: number, patch: Partial<TWorkspaceDraft>) =>
    setWorkspaces((current) =>
      current.map((workspace, i) => (i === index ? { ...workspace, ...patch } : workspace))
    );

  const pickMember = (index: number, userId: string) => {
    // Owners and managers administer every team they are in; everyone else starts as a contributor.
    const picked = memberById.get(userId);
    const role = picked?.role === "owner" || picked?.role === "manager" ? "admin" : "contributor";
    patchMember(index, { userId, role });
  };

  const hasEmptyMember = members.some((member) => !member.userId);
  const hasEmptyWorkspace = workspaces.some((workspace) => !workspace.workspaceId);
  const canAddMember = canEditMembers && !hasEmptyMember && members.length < orgMembers.length;
  const canAddWorkspace = canEditWorkspaces && !hasEmptyWorkspace && workspaces.length < orgWorkspaces.length;

  const roleOptions = [
    { value: ZTeamRole.enum.admin, label: t("shell.organization.teams.role_admin") },
    { value: ZTeamRole.enum.contributor, label: t("shell.organization.teams.role_contributor") },
  ];
  const permissionOptions = [
    { value: ZTeamPermission.enum.read, label: t("shell.organization.teams.permission_read_label") },
    {
      value: ZTeamPermission.enum.readWrite,
      label: t("shell.organization.teams.permission_read_write_label"),
    },
    { value: ZTeamPermission.enum.manage, label: t("shell.organization.teams.permission_manage_label") },
  ];

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = ZTeamSettingsFormSchema.safeParse({
      name,
      members: members.filter((member) => member.userId),
      workspaces: workspaces.filter((workspace) => workspace.workspaceId),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("common.something_went_wrong_please_try_again"));
      return;
    }

    setBusy("save");
    try {
      const result = await updateTeamDetailsAction({ teamId: details.id, data: parsed.data });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        setError(message);
        return;
      }
      toast.success(t("shell.organization.teams.updated"));
      onClose();
      router.refresh();
    } catch {
      setError(t("common.something_went_wrong_please_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      const result = await deleteTeamAction({ teamId: details.id });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        setError(message);
        setIsConfirmingDelete(false);
        return;
      }
      toast.success(t("shell.organization.teams.deleted"));
      onClose();
      router.refresh();
    } catch {
      setError(t("common.something_went_wrong_please_try_again"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogBody className="flex flex-col gap-6 px-px py-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor="team-name">{t("shell.organization.teams.name")}</Label>
          <Input
            id="team-name"
            value={name}
            disabled={!canEditMembers}
            onChange={(event) => setName(event.target.value)}
          />
          <IdBadge id={details.id} label={t("common.team_id")} variant="column" />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-800">{t("common.members")}</legend>
          <p className="text-xs text-slate-500">{t("shell.organization.teams.members_description")}</p>
          {members.map((member, index) => {
            const picked = memberById.get(member.userId);
            const isRoleLocked =
              !canEditMembers ||
              picked?.role === "owner" ||
              picked?.role === "manager" ||
              member.userId === currentUserId;
            const canRemove = isOwnerOrManager || (isTeamAdminMember && member.userId !== currentUserId);

            return (
              <div
                key={member.userId || `new-${index}`}
                className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Select
                  value={member.userId}
                  onValueChange={(value) => pickMember(index, value)}
                  disabled={existingMemberIds.has(member.userId) || !canEditMembers}>
                  <SelectTrigger
                    aria-label={t("shell.organization.teams.member_label")}
                    className="min-w-0 flex-1">
                    <SelectValue placeholder={t("shell.organization.teams.select_member")} />
                  </SelectTrigger>
                  <SelectContent>
                    {memberOptions(index).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={member.role}
                  onValueChange={(value) => patchMember(index, { role: value as TTeamRole })}
                  disabled={isRoleLocked}>
                  <SelectTrigger
                    aria-label={t("shell.organization.teams.team_role_label")}
                    className="w-40 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {members.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!canRemove}
                    aria-label={t("shell.organization.teams.remove_member")}
                    onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}>
                    <XIcon />
                  </Button>
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={!canAddMember}
            onClick={() =>
              setMembers((current) => [...current, { userId: "", role: ZTeamRole.enum.contributor }])
            }>
            <PlusIcon />
            {t("shell.organization.teams.add_member")}
          </Button>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-800">{t("common.workspaces")}</legend>
          <p className="text-xs text-slate-500">{t("shell.organization.teams.workspaces_description")}</p>
          {workspaces.map((workspace, index) => (
            <div
              key={workspace.workspaceId || `new-${index}`}
              className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Select
                value={workspace.workspaceId}
                onValueChange={(value) => patchWorkspace(index, { workspaceId: value })}
                disabled={existingWorkspaceIds.has(workspace.workspaceId) || !canEditWorkspaces}>
                <SelectTrigger
                  aria-label={t("shell.organization.teams.workspace_label")}
                  className="min-w-0 flex-1">
                  <SelectValue placeholder={t("shell.organization.teams.select_workspace")} />
                </SelectTrigger>
                <SelectContent>
                  {workspaceOptions(index).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={workspace.permission}
                onValueChange={(value) => patchWorkspace(index, { permission: value as TTeamPermission })}
                disabled={!canEditWorkspaces}>
                <SelectTrigger
                  aria-label={t("shell.organization.teams.permission_label")}
                  className="w-40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permissionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workspaces.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canEditWorkspaces}
                  aria-label={t("shell.organization.teams.remove_workspace")}
                  onClick={() => setWorkspaces((current) => current.filter((_, i) => i !== index))}>
                  <XIcon />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={!canAddWorkspace}
            onClick={() =>
              setWorkspaces((current) => [
                ...current,
                { workspaceId: "", permission: ZTeamPermission.enum.read },
              ])
            }>
            <PlusIcon />
            {t("shell.organization.teams.add_workspace")}
          </Button>
        </fieldset>

        {isConfirmingDelete && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {t("shell.organization.teams.delete_confirmation", { name: details.name })}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        {isOwnerOrManager && !isConfirmingDelete && (
          <Button
            type="button"
            variant="destructive"
            className="sm:mr-auto"
            onClick={() => setIsConfirmingDelete(true)}>
            {t("shell.organization.teams.delete_team")}
          </Button>
        )}
        {isConfirmingDelete ? (
          <>
            <Button type="button" variant="outline" onClick={() => setIsConfirmingDelete(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" loading={busy === "delete"} onClick={handleDelete}>
              {t("shell.organization.teams.delete_team")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy === "save"} disabled={!canEditMembers}>
              {t("common.save")}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
};
