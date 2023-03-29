"use client";

import { Button } from "@formbricks/ui";
import { Input } from "@formbricks/ui";
import { Label } from "@formbricks/ui";

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
