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

type AddMemberRole = {
  control: Control<{ name: string; email: string; role: MembershipRole }, any>;
};

export const AddMemberRole = ({ control }: AddMemberRole) => {
  return (
    <Controller
      name="role"
      control={control}
      render={({ field: { onChange, value } }) => (
        <div>
          <Label>Role</Label>
          <Select value={value} onValueChange={(v) => onChange(v as MembershipRole)}>
            <SelectTrigger className="capitalize">
              <SelectValue placeholder={<span className="text-slate-400">Select role</span>} />
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
