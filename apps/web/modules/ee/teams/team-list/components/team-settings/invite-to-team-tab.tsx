"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { inviteToTeamAction } from "../../actions";

const ZInviteToTeamForm = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

type TInviteToTeamForm = z.infer<typeof ZInviteToTeamForm>;

interface InviteToTeamTabProps {
  teamId: string;
  teamName: string;
  onSuccess: () => void;
}

export const InviteToTeamTab = ({ teamId, teamName, onSuccess }: InviteToTeamTabProps) => {
  const { t } = useTranslation();

  const form = useForm<TInviteToTeamForm>({
    resolver: zodResolver(ZInviteToTeamForm),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = async (data: TInviteToTeamForm) => {
    try {
      const result = await inviteToTeamAction({
        teamId,
        email: data.email,
        name: data.name,
      });

      if (result?.data) {
        toast.success(t("environments.settings.teams.invite_success", { name: data.name, team: teamName }));
        form.reset();
        onSuccess();
      } else {
        const errorMessage = getFormattedErrorMessage(result);

        // Provide helpful error messages
        if (errorMessage.includes("already a member")) {
          toast.error(t("environments.settings.teams.already_member_error"));
        } else if (errorMessage.includes("Invite already exists")) {
          toast.error(t("environments.settings.teams.already_invited_error"));
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("common.full_name")}</FormLabel>
            <FormControl>
              <Input {...field} placeholder={t("environments.settings.teams.invite_name_placeholder")} />
            </FormControl>
            <FormError />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("common.email")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="email"
                placeholder={t("environments.settings.teams.invite_email_placeholder")}
              />
            </FormControl>
            <FormError />
          </FormItem>
        )}
      />

      <FormItem>
        <FormLabel>{t("environments.settings.teams.organization_role")}</FormLabel>
        <FormControl>
          <Input value={t("environments.settings.teams.member")} disabled />
        </FormControl>
      </FormItem>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
          {t("environments.settings.teams.send_invite")}
        </Button>
      </div>
    </div>
  );
};
