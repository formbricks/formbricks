"use client";

import { updateTeamSupportEmailAction } from "@/app/(app)/environments/[environmentId]/settings/members/actions";
import { TTeam } from "@formbricks/types/v1/teams";
import { Button, Input, Label } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const ZEmail = z.string().email("Please enter a valid email address.");

type TTeamSupportEmailForm = {
  supportEmail: string;
};

type EditTeamSupportEmailProps = {
  environmentId: string;
  team: TTeam;
};

export default function EditTeamSupportEmail({ team }: EditTeamSupportEmailProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TTeamSupportEmailForm>({
    defaultValues: {
      supportEmail: team.supportEmail ?? "",
    },
    mode: "onSubmit",
  });
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);

  const supportEmail = useWatch({
    control,
    name: "supportEmail",
  });

  const currentSupportEmail = supportEmail?.trim().toLowerCase() ?? "";
  const previousTeamName = team?.supportEmail?.trim().toLowerCase() ?? "";

  const handleUpdateTeamName: SubmitHandler<TTeamSupportEmailForm> = async (data) => {
    try {
      setIsUpdatingTeam(true);
      await updateTeamSupportEmailAction(team.id, data.supportEmail);

      setIsUpdatingTeam(false);
      toast.success(
        data.supportEmail ? "Support email updated successfully." : "Support email removed successfully."
      );

      router.refresh();
    } catch (err) {
      setIsUpdatingTeam(false);
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <form className="w-full max-w-sm items-center" onSubmit={handleSubmit(handleUpdateTeamName)}>
      <Label htmlFor="supportEmail">Public Support Email</Label>
      <Input
        type="text"
        id="supportEmail"
        defaultValue={team?.supportEmail ?? ""}
        {...register("supportEmail", {
          validate: (value) => {
            // allow user to unset support email
            if (value === "") {
              return true;
            }
            const validatedInput = ZEmail.safeParse(value);
            return validatedInput.success || validatedInput.error.errors[0].message;
          },
        })}
      />

      {supportEmail && errors?.supportEmail?.message && (
        <p className="text-xs text-red-500">{errors.supportEmail.message}</p>
      )}

      <Button
        type="submit"
        className="mt-4"
        variant="darkCTA"
        loading={isUpdatingTeam}
        disabled={currentSupportEmail === previousTeamName}>
        Update
      </Button>
    </form>
  );
}
