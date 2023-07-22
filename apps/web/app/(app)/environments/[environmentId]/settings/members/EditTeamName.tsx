"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeamMutation } from "@/lib/teams/mutateTeams";
import { useTeam } from "@/lib/teams/teams";
import { Button, ErrorComponent, Input, Label } from "@formbricks/ui";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";

export default function EditTeamName({ environmentId }) {
  const { team, isLoadingTeam, isErrorTeam, mutateTeam } = useTeam(environmentId);
  const { register, control, handleSubmit, setValue } = useForm();
  const [teamId, setTeamId] = useState("");

  const teamName = useWatch({
    control,
    name: "name",
  });
  const isTeamNameInputEmpty = !teamName?.trim();
  const currentTeamName = teamName?.trim().toLowerCase() ?? "";
  const previousTeamName = team?.name?.trim().toLowerCase() ?? "";

  useEffect(() => {
    if (team && team.id !== "") {
      setTeamId(team.id);
    }
    setValue("name", team?.name ?? "");
  }, [team]);

  const { isMutatingTeam, triggerTeamMutate } = useTeamMutation(teamId);

  if (isLoadingTeam) {
    return <LoadingSpinner />;
  }
  if (isErrorTeam) {
    return <ErrorComponent />;
  }

  return (
    <form
      className="w-full max-w-sm items-center"
      onSubmit={handleSubmit((data) => {
        if (currentTeamName === previousTeamName) {
          return toast.error("Please change team name to update");
        }
        triggerTeamMutate({ ...data })
          .catch((error) => {
            toast.error(`Error: ${error.message}`);
          })
          .then(() => {
            toast.success("Team name updated successfully.");
            mutateTeam(); // Added to trigger SWR to update the team name in menus
          });
      })}>
      <Label htmlFor="teamname">Team Name</Label>
      <Input
        type="text"
        id="teamname"
        defaultValue={team?.name ?? ""}
        {...register("name")}
        className={isTeamNameInputEmpty ? "border-red-300 focus:border-red-300" : ""}
      />

      <Button
        type="submit"
        className="mt-4"
        variant="darkCTA"
        loading={isMutatingTeam}
        disabled={isTeamNameInputEmpty || currentTeamName === previousTeamName}>
        Update
      </Button>
    </form>
  );
}
