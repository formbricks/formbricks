"use client";

import { updateTeamNameAction } from "@/app/(app)/environments/[environmentId]/settings/members/actions";
import { TTeam } from "@formbricks/types/v1/teams";
import { Button, Input, Label } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";

type TEditTeamNameForm = {
  name: string;
};

type TEditTeamNameProps = {
  environmentId: string;
  team: TTeam;
};

export default function EditTeamName({ team }: TEditTeamNameProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TEditTeamNameForm>({
    defaultValues: {
      name: team.name,
    },
  });
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);

  const teamName = useWatch({
    control,
    name: "name",
  });

  const isTeamNameInputEmpty = !teamName?.trim();
  const currentTeamName = teamName?.trim().toLowerCase() ?? "";
  const previousTeamName = team?.name?.trim().toLowerCase() ?? "";

  const handleUpdateTeamName: SubmitHandler<TEditTeamNameForm> = async (data) => {
    try {
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

  return (
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
        loading={isUpdatingTeam}
        disabled={isTeamNameInputEmpty || currentTeamName === previousTeamName}>
        Update
      </Button>
    </form>
  );
}
