"use client";

import { useMemo } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags, getOrganizationRoleLabels } from "@/lib/membership/utils";
import { getAssignableOrganizationRoles } from "@/modules/ee/role-management/lib/assignable-roles";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Muted, P } from "@/modules/ui/components/typography";

interface AddMemberRoleProps {
  readonly control: Control<{ name: string; email: string; role: TOrganizationRole; teamIds: string[] }>;
  readonly isAccessControlAllowed: boolean;
  readonly isFormbricksCloud: boolean;
  readonly isDashboardViewerRoleEnabled: boolean;
  readonly membershipRole?: TOrganizationRole;
}

export function AddMemberRole({
  control,
  isAccessControlAllowed,
  isFormbricksCloud,
  isDashboardViewerRoleEnabled,
  membershipRole,
}: AddMemberRoleProps) {
  const { isMember } = getAccessFlags(membershipRole);

  const { t } = useTranslation();

  const roleLabels = getOrganizationRoleLabels(t);

  const roles = useMemo(
    () =>
      getAssignableOrganizationRoles({
        assignerRole: membershipRole,
        isFormbricksCloud,
        isDashboardViewerRoleEnabled,
      }),
    [membershipRole, isFormbricksCloud, isDashboardViewerRoleEnabled]
  );

  if (isMember) return null;

  const rolesDescription: Record<TOrganizationRole, string> = {
    owner: t("workspace.settings.teams.owner_role_description"),
    manager: t("workspace.settings.teams.manager_role_description"),
    member: t("workspace.settings.teams.member_role_description"),
    billing: t("workspace.settings.teams.billing_role_description"),
    dashboard_viewer: t("workspace.settings.teams.dashboard_viewer_role_description"),
  };

  return (
    <Controller
      control={control}
      name="role"
      render={({ field: { onChange, value } }) => (
        <div className="flex flex-col gap-y-2">
          <Label>{t("workspace.settings.teams.organization_role")}</Label>
          <Select
            defaultValue={isAccessControlAllowed ? "member" : "owner"}
            disabled={!isAccessControlAllowed}
            onValueChange={(v) => {
              onChange(v as TOrganizationRole);
            }}
            value={value}>
            <SelectTrigger>
              <SelectValue>
                <P>{roleLabels[value]}</P>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup className="flex flex-col-reverse">
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    <P>{roleLabels[role]}</P>
                    <Muted className="text-slate-500">{rolesDescription[role]}</Muted>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
    />
  );
}
