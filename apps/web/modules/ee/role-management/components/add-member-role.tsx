import { OrganizationRole } from "@prisma/client";
import { useTranslations } from "next-intl";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { Label } from "@formbricks/ui/components/Label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";

interface AddMemberRoleProps {
  control: Control<{ name: string; email: string; organizationRole: TOrganizationRole }>;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
}

export function AddMemberRole({ control, canDoRoleManagement, isFormbricksCloud }: AddMemberRoleProps) {
  const roles = isFormbricksCloud
    ? Object.values(OrganizationRole)
    : Object.keys(OrganizationRole).filter((role) => role !== "billing");

  const t = useTranslations();
  return (
    <Controller
      control={control}
      name="organizationRole"
      render={({ field: { onChange, value } }) => (
        <div>
          <Label>{t("common.role")}</Label>
          <Select
            defaultValue="owner"
            disabled={!canDoRoleManagement}
            onValueChange={(v) => {
              onChange(v as TOrganizationRole);
            }}
            value={value}>
            <SelectTrigger className="capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {roles.map((role) => (
                  <SelectItem className="capitalize" key={role} value={role}>
                    {role}
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
