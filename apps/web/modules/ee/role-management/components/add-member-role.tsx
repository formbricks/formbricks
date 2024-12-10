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
import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface AddMemberRoleProps {
  control: Control<{ name: string; email: string; role: TOrganizationRole }>;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
}

export function AddMemberRole({ control, canDoRoleManagement, isFormbricksCloud }: AddMemberRoleProps) {
  const roles = isFormbricksCloud
    ? Object.values(OrganizationRole)
    : Object.keys(OrganizationRole).filter((role) => role !== "billing");

  const rolesDescription = {
    owner: "Owners have full control over the organization.",
    manager: "Managers can access all projects and add and remove members.",
    member: "Members can work within projects.",
    billing: "Only have access to billing info.",
  };

  const t = useTranslations();
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
                  <SelectItem className="capitalize" key={role} value={role}>
                    <P>{role}</P>
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
