import { OrganizationRole } from "@prisma/client";
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
}

export function AddMemberRole({ control, canDoRoleManagement }: AddMemberRoleProps) {
  return (
    <Controller
      control={control}
      name="organizationRole"
      render={({ field: { onChange, value } }) => (
        <div>
          <Label>Role</Label>
          <Select
            defaultValue="manager"
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
                {Object.values(OrganizationRole).map((role) => (
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
