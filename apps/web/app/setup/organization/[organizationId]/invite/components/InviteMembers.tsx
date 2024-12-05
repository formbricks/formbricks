"use client";

import { inviteOrganizationMemberAction } from "@/app/setup/organization/[organizationId]/invite/actions";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TInviteMembersFormSchema, ZInviteMembersFormSchema } from "@formbricks/types/invites";

interface InviteMembersProps {
  IS_SMTP_CONFIGURED: boolean;
  organizationId: string;
}

export const InviteMembers = ({ IS_SMTP_CONFIGURED, organizationId }: InviteMembersProps) => {
  const t = useTranslations();
  const [membersCount, setMembersCount] = useState(1);
  const router = useRouter();

  const form = useForm<TInviteMembersFormSchema>({
    resolver: zodResolver(ZInviteMembersFormSchema),
  });

  const { isSubmitting } = form.formState;

  const inviteTeamMembers = async (data: TInviteMembersFormSchema) => {
    const emails = Object.values(data).filter((email) => email && email.trim());
    if (!emails.length) {
      router.push("/");
      return;
    }

    for (const email of emails) {
      try {
        if (!email) continue;
        await inviteOrganizationMemberAction({ email, organizationId });
        if (IS_SMTP_CONFIGURED) {
          toast.success(`${t("setup.invite.invitation_sent_to")} ${email}!`);
        }
      } catch (error) {
        console.error("Failed to invite:", email, error);
        toast.error(`${t("setup.invite.failed_to_invite")} ${email}.`);
      }
    }

    router.push("/");
  };

  const handleSkip = () => {
    router.push("/");
  };

  return (
    <FormProvider {...form}>
      {!IS_SMTP_CONFIGURED && (
        <Alert variant="warning">
          <AlertTitle>{t("setup.invite.smtp_not_configured")}</AlertTitle>
          <AlertDescription>{t("setup.invite.smtp_not_configured_description")}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={form.handleSubmit(inviteTeamMembers)} className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-medium">{t("setup.invite.invite_your_organization_members")}</h2>
          <p>{t("setup.invite.life_s_no_fun_alone")}</p>

          {Array.from({ length: membersCount }).map((_, index) => (
            <FormField
              key={`member-${index}`}
              control={form.control}
              name={`member-${index}`}
              render={({ field, fieldState: { error } }) => (
                <FormItem>
                  <FormControl>
                    <div>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder={`user@example.com`}
                          className="w-80"
                          isInvalid={!!error?.message}
                        />
                      </div>
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          ))}

          <Button variant="ghost" onClick={() => setMembersCount((count) => count + 1)} type="button">
            <PlusIcon />
            {t("setup.invite.add_another_member")}
          </Button>

          <hr className="my-6 w-full border-slate-200" />

          <div className="space-y-2">
            <Button
              className="flex w-80 justify-center"
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}>
              {t("setup.invite.continue")}
            </Button>
            <Button type="button" variant="ghost" className="flex w-80 justify-center" onClick={handleSkip}>
              {t("setup.invite.skip")}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
