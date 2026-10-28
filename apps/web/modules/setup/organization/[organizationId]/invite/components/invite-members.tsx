"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthField } from "@/modules/auth/components/auth-field";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { inviteOrganizationMemberAction } from "@/modules/setup/organization/[organizationId]/invite/actions";
import {
  type TInviteMembersFormSchema,
  ZInviteMembersFormSchema,
} from "@/modules/setup/organization/[organizationId]/invite/types/invites";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

// Bounds the onboarding invite form so a single submit cannot fan out an unlimited number of
// owner invites. The server-side rate limit is the real guard; this keeps the UI sensible.
const MAX_INVITE_MEMBERS = 10;

interface InviteMembersProps {
  IS_SMTP_CONFIGURED: boolean;
  organizationId: string;
}

export const InviteMembers = ({ IS_SMTP_CONFIGURED, organizationId }: Readonly<InviteMembersProps>) => {
  const { t } = useTranslation();
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
          toast.success(t("setup.invite.invitation_sent_to_email", { email: member.email }));
        } else {
          const errorMessage = getFormattedErrorMessage(inviteResponse);
          toast.error(errorMessage);
        }
      } catch {
        toast.error(`${t("setup.invite.failed_to_invite")} ${member.email}.`);
      }
    }

    router.push("/");
  };

  const handleSkip = () => {
    router.push("/");
  };

  return (
    <>
      <AuthHeading
        title={t("setup.invite.invite_your_organization_members")}
        description={t("setup.invite.life_s_no_fun_alone")}
      />
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
        className="flex flex-col gap-4">
        {Array.from({ length: membersCount }).map((_, index) => {
          const key = `member-${index.toString()}`;
          const memberErrors = form.formState.errors[key];
          return (
            <div key={key} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
              <AuthField id={`${key}-email`} label={t("common.email")} error={memberErrors?.email?.message}>
                <Input
                  id={`${key}-email`}
                  type="email"
                  autoComplete="off"
                  placeholder="user@example.com"
                  isInvalid={Boolean(memberErrors?.email)}
                  {...form.register(`${key}.email`)}
                />
              </AuthField>
              <AuthField id={`${key}-name`} label={t("common.full_name")} error={memberErrors?.name?.message}>
                <Input
                  id={`${key}-name`}
                  autoComplete="off"
                  isInvalid={Boolean(memberErrors?.name)}
                  {...form.register(`${key}.name`)}
                />
              </AuthField>
            </div>
          );
        })}

        <Button
          variant="outline"
          onClick={() => {
            setMembersCount((count) => Math.min(count + 1, MAX_INVITE_MEMBERS));
          }}
          type="button"
          disabled={membersCount >= MAX_INVITE_MEMBERS}>
          <PlusIcon />
          {t("setup.invite.add_another_member")}
        </Button>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-5">
          <Button className="h-11 w-full justify-center sm:h-9" type="submit" loading={isSubmitting}>
            {t("setup.invite.continue")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full justify-center sm:h-9"
            onClick={handleSkip}>
            {t("setup.invite.skip")}
          </Button>
        </div>
      </form>
    </>
  );
};
