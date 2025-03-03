"use client";

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
import { OrganizationRole } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface AddMemberRoleProps {
  control: Control<{ name: string; email: string; role: TOrganizationRole; teamIds: string[] }>;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
}

export function AddMemberRole({ control, canDoRoleManagement, isFormbricksCloud }: AddMemberRoleProps) {
  const roles = isFormbricksCloud
    ? Object.values(OrganizationRole)
    : Object.keys(OrganizationRole).filter((role) => role !== "billing");

  const { t } = useTranslate();

  const rolesDescription = {
    owner: t("environments.settings.teams.owner_role_description"),
    manager: t("environments.settings.teams.manager_role_description"),
    member: t("environments.settings.teams.member_role_description"),
    billing: t("environments.settings.teams.billing_role_description"),
  };

  return (
    <Controller
      control={control}
      name="role"
      render={({ field: { onChange, value } }) => (
        <div className="flex flex-col space-y-2">
          <Label>{t("common.role_organization")}</Label>
          <Select
            defaultValue="owner"
            disabled={!canDoRoleManagement}
            onValueChange={(v) => {
              onChange(v as TOrganizationRole);
            }}
            value={value}>
            <SelectTrigger className="capitalize">
              <SelectValue>
                <P>{value}</P>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    <P className="capitalize">{role}</P>
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
