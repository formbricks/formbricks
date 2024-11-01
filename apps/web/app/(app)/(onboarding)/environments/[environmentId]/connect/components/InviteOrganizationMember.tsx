"use client";

import { inviteOrganizationMemberAction } from "@/app/(app)/(onboarding)/organizations/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { TOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/components/Button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";

interface InviteOrganizationMemberProps {
  organization: TOrganization;
  environmentId: string;
}

const ZInviteOrganizationMemberDetails = z.object({
  email: z.string().email(),
  inviteMessage: z.string().trim().min(1),
});
type TInviteOrganizationMemberDetails = z.infer<typeof ZInviteOrganizationMemberDetails>;

export const InviteOrganizationMember = ({ organization, environmentId }: InviteOrganizationMemberProps) => {
  const router = useRouter();
  const t = useTranslations();
  const form = useForm<TInviteOrganizationMemberDetails>({
    defaultValues: {
      email: "",
      inviteMessage: t("environments.connect.invite.invite_message_content"),
    },
    resolver: zodResolver(ZInviteOrganizationMemberDetails),
  });
  const { isSubmitting } = form.formState;

  const handleInvite = async (data: TInviteOrganizationMemberDetails) => {
    try {
      await inviteOrganizationMemberAction({
        organizationId: organization.id,
        email: data.email,
        role: "developer",
        inviteMessage: data.inviteMessage,
      });
      toast.success("Invite sent successful");
      await finishOnboarding();
    } catch (error) {
      toast.error("An unexpected error occurred");
    }
  };

  const finishOnboarding = async () => {
    router.push(`/environments/${environmentId}/surveys`);
  };

  return (
    <div className="mb-8 w-full max-w-xl space-y-8">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleInvite)} className="w-full space-y-4">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <FormLabel>{t("common.email")}</FormLabel>
                  <FormControl>
                    <div>
                      <Input
                        value={field.value}
                        onChange={(email) => field.onChange(email)}
                        placeholder="engineering@acme.com"
                        className="bg-white"
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inviteMessage"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <FormLabel>{t("environments.connect.invite.invite_message")}</FormLabel>
                  <FormControl>
                    <div>
                      <textarea
                        rows={5}
                        className="focus:border-brand-dark flex w-full rounded-md border border-slate-300 bg-transparent bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
                        value={field.value}
                        onChange={(inviteMessage) => field.onChange(inviteMessage)}
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex w-full justify-end space-x-2">
              <Button
                id="onboarding-inapp-invite-have-a-look-first"
                className="text-slate-400"
                variant="minimal"
                onClick={(e) => {
                  e.preventDefault();
                  finishOnboarding();
                }}>
                {t("common.not_now")}
              </Button>
              <Button id="onboarding-inapp-invite-send-invite" type={"submit"} loading={isSubmitting}>
                {t("common.invite")}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
