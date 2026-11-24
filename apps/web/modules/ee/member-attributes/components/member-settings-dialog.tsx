"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getOrganizationRoleLabels } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { updateInviteRole, updateMemberRole } from "@/modules/ee/role-management/lib/api-client";
import { getAssignableOrganizationRoles } from "@/modules/ee/role-management/lib/assignable-roles";
import { TeamPermissionTranslationKeys } from "@/modules/ee/teams/utils/teams";
import { deleteInvite, deleteMember } from "@/modules/organization/settings/teams/lib/api-client";
import {
  type TMemberTableRow,
  getAttributeSuggestions,
  getChangedAttributes,
} from "@/modules/organization/settings/teams/lib/member-table";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
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
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { Muted } from "@/modules/ui/components/typography";
import { useBulkSetMemberAttributes } from "../hooks/use-member-attributes";
import { MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY, MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH } from "../lib/limits";

const TEAM_ROLE_LABEL_KEYS = {
  admin: "workspace.settings.teams.team_admin",
  contributor: "workspace.settings.teams.contributor",
} as const;

export type TMemberSettingsAttributeKey = { key: string; label: string };

export type TMemberSettingsDialogProps = Readonly<{
  organizationId: string;
  row: TMemberTableRow;
  /** Every row, for the values the attribute fields suggest. */
  allRows: readonly TMemberTableRow[];
  open: boolean;
  setOpen: (open: boolean) => void;
  currentUserRole: TOrganizationRole;
  isFormbricksCloud: boolean;
  isDashboardViewerRoleEnabled: boolean;
  /** Whether the role can be changed here (`isRoleEditDisabled` false, Access Control on). */
  canEditRole: boolean;
  /** Whether attributes can be changed here (an Owner or Manager above the floor, Member attributes on). */
  canEditAttributes: boolean;
  canDelete: boolean;
  /** The organization's attribute keys; empty when there are none or the viewer may not read them. */
  attributeKeys: readonly TMemberSettingsAttributeKey[];
}>;

/**
 * Member settings (ENG-7474), built like Team settings: name and email, the role (moved here from the
 * table's inline dropdown, with the same rules), the member's teams (read only), and one tags field per
 * Member attribute. A member viewing themself sees their attributes read only.
 *
 * Role and delete go through the existing role and membership actions, which keep every rule they enforce;
 * attributes are saved through the v3 bulk endpoint, sending only the keys that changed.
 */
export const MemberSettingsDialog = ({
  organizationId,
  row,
  allRows,
  open,
  setOpen,
  currentUserRole,
  isFormbricksCloud,
  isDashboardViewerRoleEnabled,
  canEditRole,
  canEditAttributes,
  canDelete,
  attributeKeys,
}: TMemberSettingsDialogProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const fieldId = useId();
  const roleLabels = getOrganizationRoleLabels(t);
  const [role, setRole] = useState<TOrganizationRole>(row.role);
  const [attributes, setAttributes] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(attributeKeys.map(({ key }) => [key, row.attributes[key] ?? []]))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const bulkMutation = useBulkSetMemberAttributes(organizationId);

  const assignableRoles = getAssignableOrganizationRoles({
    assignerRole: currentUserRole,
    isFormbricksCloud,
    isDashboardViewerRoleEnabled,
  });
  const roleOptions = assignableRoles.includes(row.role) ? assignableRoles : [row.role, ...assignableRoles];

  const saveRole = async (): Promise<boolean> => {
    if (role === row.role) return true;
    try {
      if (row.kind === "member" && row.member) {
        await updateMemberRole({ userId: row.member.userId, organizationId, body: { role } });
      } else if (row.invite) {
        await updateInviteRole({ inviteId: row.invite.id, body: { role } });
      }
      return true;
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      return false;
    }
  };

  const saveAttributes = async (): Promise<boolean> => {
    const changed = getChangedAttributes(row.attributes, attributes);
    if (!canEditAttributes || Object.keys(changed).length === 0) return true;
    try {
      const result = await bulkMutation.mutateAsync([{ email: row.email, attributes: changed }]);
      const outcome = result.rows[0];
      if (outcome?.status === "invalid") {
        toast.error(outcome.problems.map((problem) => problem.reason).join(", "));
        return false;
      }
      return true;
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      return false;
    }
  };

  const onSave = async () => {
    setIsSaving(true);
    try {
      const roleChanged = role !== row.role;
      if (!(await saveRole())) return;
      if (!(await saveAttributes())) return;
      toast.success(t("workspace.settings.members.member_settings_saved"));
      setOpen(false);
      if (roleChanged) router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    setIsDeleting(true);
    try {
      if (row.kind === "member" && row.member) {
        await deleteMember({ userId: row.member.userId, organizationId });
      } else if (row.invite) {
        await deleteInvite(row.invite.id);
      } else {
        return;
      }
      toast.success(
        row.kind === "member"
          ? t("workspace.settings.general.member_deleted_successfully")
          : t("workspace.settings.general.invite_deleted_successfully")
      );
      setIsDeleteOpen(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>{t("workspace.settings.members.member_settings")}</DialogTitle>
          <DialogDescription>{t("workspace.settings.members.member_settings_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grow space-y-6 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-name`}>{t("common.full_name")}</Label>
              <Input id={`${fieldId}-name`} value={row.name} disabled className="ph-no-capture" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-email`}>{t("common.email")}</Label>
              <Input id={`${fieldId}-email`} value={row.email} disabled className="ph-no-capture" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-role`}>{t("common.role")}</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as TOrganizationRole)}
              disabled={!canEditRole}>
              <SelectTrigger id={`${fieldId}-role`} className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option} value={option} disabled={!assignableRoles.includes(option)}>
                    {roleLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Muted className="text-slate-500">{t("workspace.settings.members.role_help")}</Muted>
          </div>

          <div className="space-y-2">
            <Label>{t("common.teams")}</Label>
            {row.teams.length === 0 ? (
              <Muted className="block text-slate-500">{t("workspace.settings.members.no_teams")}</Muted>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("workspace.settings.members.team")}</TableHead>
                      <TableHead>{t("workspace.settings.members.team_role")}</TableHead>
                      <TableHead>{t("workspace.settings.members.workspace_access")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.teams.map((team) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium text-slate-900">{team.name}</TableCell>
                        <TableCell className="text-slate-600">
                          {team.role ? t(TEAM_ROLE_LABEL_KEYS[team.role]) : "—"}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {team.workspaceAccess.length === 0
                            ? "—"
                            : team.workspaceAccess
                                .map(
                                  (access) =>
                                    `${access.name} (${t(
                                      TeamPermissionTranslationKeys[
                                        access.permission as keyof typeof TeamPermissionTranslationKeys
                                      ] ?? access.permission
                                    )})`
                                )
                                .join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {attributeKeys.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-y-1">
                <Label>{t("workspace.settings.member_attributes.title")}</Label>
                <Muted className="text-slate-500">
                  {canEditAttributes
                    ? t("workspace.settings.members.attributes_help")
                    : t("workspace.settings.members.attributes_read_only_help")}
                </Muted>
              </div>
              {attributeKeys.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label id={`${fieldId}-${key}-label`} htmlFor={`${fieldId}-${key}`}>
                    {label}
                  </Label>
                  <MultiSelect
                    inputId={`${fieldId}-${key}`}
                    ariaLabelledBy={`${fieldId}-${key}-label`}
                    value={attributes[key] ?? []}
                    onChange={(values) => setAttributes((current) => ({ ...current, [key]: values }))}
                    options={(canEditAttributes ? getAttributeSuggestions(allRows, key) : []).map(
                      (suggestion) => ({
                        value: suggestion,
                        label: suggestion,
                      })
                    )}
                    creatable
                    readOnly={!canEditAttributes}
                    maxSelected={MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY}
                    inputMaxLength={MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH}
                    placeholder={t("common.tags_field.add_value_placeholder")}
                    emptyMessage={t("common.tags_field.no_values_yet")}
                  />
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <div className="w-full">
            {canDelete && (
              <Button type="button" variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                {t("workspace.settings.members.delete_member")}
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          {(canEditRole || canEditAttributes) && (
            <Button type="button" loading={isSaving} onClick={() => void onSave()}>
              {t("common.save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <DeleteDialog
        open={isDeleteOpen}
        setOpen={setIsDeleteOpen}
        deleteWhat={t("workspace.settings.general.from_your_organization", {
          memberName: row.name || row.email,
        })}
        onDelete={() => void onDelete()}
        isDeleting={isDeleting}
        text={t("workspace.settings.general.delete_member_confirmation")}
      />
    </Dialog>
  );
};
