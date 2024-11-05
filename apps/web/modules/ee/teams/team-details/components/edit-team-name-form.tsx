"use client";

import { updateTeamNameAction } from "@/modules/ee/teams/team-details/actions";
import { TTeam, ZTeam } from "@/modules/ee/teams/team-details/types/teams";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { Button } from "@formbricks/ui/components/Button";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";

interface EditTeamNameProps {
  team: TTeam;
  membershipRole?: TOrganizationRole;
}

const ZEditTeamNameFormSchema = ZTeam.pick({ name: true });
type EditTeamNameForm = z.infer<typeof ZEditTeamNameFormSchema>;

export const EditTeamNameForm = ({ membershipRole, team }: EditTeamNameProps) => {
  const t = useTranslations();
  const form = useForm<EditTeamNameForm>({
    defaultValues: {
      name: team.name,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditTeamNameFormSchema),
  });

  const { isMember } = getAccessFlags(membershipRole);

  const { isSubmitting, isDirty } = form.formState;

  const handleUpdateTeamName: SubmitHandler<EditTeamNameForm> = async (data) => {
    try {
      const name = data.name.trim();
      const updatedTeamResponse = await updateTeamNameAction({
        teamId: team.id,
        name,
      });

      if (updatedTeamResponse?.data) {
        toast.success("Team name updated successfully.");
        form.reset({ name: updatedTeamResponse.data.name });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedTeamResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return isMember ? (
    <p className="text-sm text-red-700">
      {t("environments.settings.teams.only_organization_owners_and_managers_can_access_this_setting")}
    </p>
  ) : (
    <FormProvider {...form}>
      <form className="w-full max-w-sm items-center" onSubmit={form.handleSubmit(handleUpdateTeamName)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("environments.settings.teams.team_name")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  isInvalid={!!fieldState.error?.message}
                  placeholder={t("environments.settings.teams.team_name")}
                  required
                />
              </FormControl>

              <FormError />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="mt-4"
          size="sm"
          loading={isSubmitting}
          disabled={isSubmitting || !isDirty}>
          {t("common.update")}
        </Button>
      </form>
    </FormProvider>
  );
};
