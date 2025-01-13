import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
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

  const t = useTranslations();
  return (
    <Controller
      control={control}
      name="role"
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
