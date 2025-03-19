"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { inviteOrganizationMemberAction } from "@/modules/setup/organization/[organizationId]/invite/actions";
import {
  type TInviteMembersFormSchema,
  ZInviteMembersFormSchema,
} from "@/modules/setup/organization/[organizationId]/invite/types/invites";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

interface InviteMembersProps {
  IS_SMTP_CONFIGURED: boolean;
  organizationId: string;
}

export const InviteMembers = ({ IS_SMTP_CONFIGURED, organizationId }: InviteMembersProps) => {
  const { t } = useTranslate();
  const [membersCount, setMembersCount] = useState(1);
  const router = useRouter();

  const form = useForm<TInviteMembersFormSchema>({
    resolver: zodResolver(ZInviteMembersFormSchema),
  });

  const { isSubmitting } = form.formState;

  const inviteTeamMembers = async (data: TInviteMembersFormSchema) => {
    for (const member of Object.values(data)) {
      try {
        if (!member.email) continue;
        const inviteResponse = await inviteOrganizationMemberAction({
          email: member.email.toLowerCase(),
          name: member.name,
          organizationId,
        });
        if (inviteResponse?.data) {
          toast.success(`${t("setup.invite.invitation_sent_to")} ${member.email}!`);
        } else {
          const errorMessage = getFormattedErrorMessage(inviteResponse);
          toast.error(errorMessage);
        }
      } catch (error) {
        toast.error(`${t("setup.invite.failed_to_invite")} ${member.email}.`);
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(inviteTeamMembers)(e);
        }}
        className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-medium">{t("setup.invite.invite_your_organization_members")}</h2>
          <p>{t("setup.invite.life_s_no_fun_alone")}</p>

          {Array.from({ length: membersCount }).map((_, index) => (
            <div key={`member-${index.toString()}`} className="space-y-2">
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
                            className="w-80"
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
                            placeholder={`Full Name (optional)`}
                            className="w-80"
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
              setMembersCount((count) => count + 1);
            }}
            type="button">
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
