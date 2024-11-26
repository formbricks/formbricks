import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Label } from "@formbricks/ui/Label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/Select";

enum MembershipRole {
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}

interface AddMemberRoleProps {
  control: Control<{ name: string; email: string; role: MembershipRole }>;
  canDoRoleManagement: boolean;
}

export function AddMemberRole({ control, canDoRoleManagement }: AddMemberRoleProps) {
  return (
    <Controller
      control={control}
      name="role"
      render={({ field: { onChange, value } }) => (
        <div>
          <Label>Role</Label>
          <Select
            defaultValue="admin"
            disabled={!canDoRoleManagement}
            onValueChange={(v) => {
              onChange(v as MembershipRole);
            }}
            value={value}>
            <SelectTrigger className="capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.values(MembershipRole).map((role) => (
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
