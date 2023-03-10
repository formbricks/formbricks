"use client";

import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function EditMembers() {
  return <div className="w-full max-w-sm items-center"></div>;
}

export function EditTeamName() {
  return (
    <div className="w-full max-w-sm items-center">
      <Label htmlFor="teamname">Team Name</Label>
      <Input type="text" id="teamname" />

      <Button type="submit" className="mt-4" onClick={(e) => console.log(e)}>
        Update
      </Button>
    </div>
  );
}
