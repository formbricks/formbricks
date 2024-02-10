import { Control, Controller } from "react-hook-form";

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

type AddMemberRoleProps = {
  control: Control<{ name: string; email: string; role: MembershipRole }, any>;
  canDoRoleManagement: boolean;
};

export const AddMemberRole = ({ control, canDoRoleManagement }: AddMemberRoleProps) => {
  return (
    <Controller
      name="role"
      control={control}
      render={({ field: { onChange, value } }) => (
        <div>
          <Label>Role</Label>
          <Select
            defaultValue="admin"
            value={value}
            onValueChange={(v) => onChange(v as MembershipRole)}
            disabled={!canDoRoleManagement}>
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
};
