"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  type TInviteMembersFormSchema,
  ZInviteMembersFormSchema,
} from "@/modules/setup/organization/[organizationId]/invite/types/invites";
import { inviteOnboardingMember } from "@/modules/setup/organization/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

// Bounds the onboarding invite form so a single submit cannot fan out an unlimited number of
// owner invites. The server-side rate limit is the real guard; this keeps the UI sensible.
const MAX_INVITE_MEMBERS = 10;

interface InviteMembersProps {
  IS_SMTP_CONFIGURED: boolean;
  organizationId: string;
}

export const InviteMembers = ({ IS_SMTP_CONFIGURED, organizationId }: InviteMembersProps) => {
  const { t } = useTranslation();
  const [membersCount, setMembersCount] = useState(1);
  const router = useRouter();

  const form = useForm<TInviteMembersFormSchema>({
    resolver: zodResolver(ZInviteMembersFormSchema),
  });

  const { isSubmitting } = form.formState;

  const inviteTeamMembers = async (data: TInviteMembersFormSchema) => {
    for (const member of Object.values(data)) {
      if (!member.email) continue;
      try {
        await inviteOnboardingMember({
          email: member.email.toLowerCase(),
          name: member.name,
          organizationId,
        });
        toast.success(t("setup.invite.invitation_sent_to_email", { email: member.email }));
      } catch (error) {
        toast.error(getV3ApiErrorMessage(error, `${t("setup.invite.failed_to_invite")} ${member.email}.`));
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
        <Alert variant="warning" role="status">
          <AlertTitle>{t("setup.invite.smtp_not_configured")}</AlertTitle>
          <AlertDescription>{t("setup.invite.smtp_not_configured_description")}</AlertDescription>
        </Alert>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(inviteTeamMembers)(e);
        }}
        className="w-full space-y-4">
        <div className="flex flex-col items-center gap-y-4">
          <h2 className="text-2xl font-medium">{t("setup.invite.invite_your_organization_members")}</h2>
          <p>{t("setup.invite.life_s_no_fun_alone")}</p>

          {Array.from({ length: membersCount }).map((_, index) => (
            <div key={`member-${index.toString()}`} className="w-full max-w-80 space-y-2">
              <FormField
                control={form.control}
                name={`member-${index.toString()}.email`}
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormControl>
                      <div>
                        <div className="relative">
                          <Input
                            {...field}
                            placeholder={`user@example.com`}
                            className="w-full"
                            isInvalid={Boolean(error?.message)}
                          />
                        </div>
                        {error?.message && <FormError className="text-left">{error.message}</FormError>}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`member-${index.toString()}.name`}
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormControl>
                      <div>
                        <div className="relative">
                          <Input
                            {...field}
                            placeholder={t("common.full_name")}
                            className="w-full"
                            isInvalid={Boolean(error?.message)}
                          />
                        </div>
                        {error?.message && <FormError className="text-left">{error.message}</FormError>}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          ))}

          <Button
            variant="ghost"
            onClick={() => {
              setMembersCount((count) => Math.min(count + 1, MAX_INVITE_MEMBERS));
            }}
            type="button"
            disabled={membersCount >= MAX_INVITE_MEMBERS}>
            <PlusIcon />
            {t("setup.invite.add_another_member")}
          </Button>

          <hr className="my-6 w-full border-slate-200" />

          <div className="w-full max-w-80 space-y-2">
            <Button
              className="flex w-full justify-center"
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}>
              {t("setup.invite.continue")}
            </Button>
            <Button type="button" variant="ghost" className="flex w-full justify-center" onClick={handleSkip}>
              {t("setup.invite.skip")}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
