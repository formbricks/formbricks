"use client";

import { updateTeamNameAction } from "@/app/(app)/environments/[environmentId]/settings/(team)/members/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";

import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface EditTeamNameForm {
  name: string;
}

interface EditTeamNameProps {
  environmentId: string;
  team: TTeam;
  membershipRole?: TMembershipRole;
}

export const EditTeamName = ({ team, membershipRole }: EditTeamNameProps) => {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditTeamNameForm>({
    defaultValues: {
      name: team.name,
    },
  });
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
  const { isViewer } = getAccessFlags(membershipRole);

  const teamName = useWatch({
    control,
    name: "name",
  });

  const isTeamNameInputEmpty = !teamName?.trim();
  const currentTeamName = teamName?.trim().toLowerCase() ?? "";
  const previousTeamName = team?.name?.trim().toLowerCase() ?? "";

  const handleUpdateTeamName: SubmitHandler<EditTeamNameForm> = async (data) => {
    try {
      data.name = data.name.trim();
      setIsUpdatingTeam(true);
      await updateTeamNameAction(team.id, data.name);

      setIsUpdatingTeam(false);
      toast.success("Team name updated successfully.");

      router.refresh();
    } catch (err) {
      setIsUpdatingTeam(false);
      toast.error(`Error: ${err.message}`);
    }
  };

  return isViewer ? (
    <p className="text-sm text-red-700">You are not authorized to perform this action.</p>
  ) : (
    <form className="w-full max-w-sm items-center" onSubmit={handleSubmit(handleUpdateTeamName)}>
      <Label htmlFor="teamname">Team Name</Label>
      <Input
        type="text"
        id="teamname"
        defaultValue={team?.name ?? ""}
        {...register("name", {
          required: {
            message: "Team name is required.",
            value: true,
          },
        })}
      />

      {errors?.name?.message && <p className="text-xs text-red-500">{errors.name.message}</p>}

      <Button
        type="submit"
        className="mt-4"
        variant="darkCTA"
        size="sm"
        loading={isUpdatingTeam}
        disabled={isTeamNameInputEmpty || currentTeamName === previousTeamName}>
        Update
      </Button>
    </form>
  );
};
