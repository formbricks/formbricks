"use client";

import { inviteOrganizationMemberAction } from "@/app/setup/member/invite/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import { TInviteMembersFormSchema, ZInviteMembersFormSchema } from "@formbricks/types/invites";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/Alert";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";

interface InviteMembersProps {
  IS_SMTP_CONFIGURED: boolean;
}

export const InviteMembers = ({ IS_SMTP_CONFIGURED }: InviteMembersProps) => {
  const [fieldNames, setFieldNames] = useState(["member1", "member2", "member3"]);
  const router = useRouter();

  const form = useForm<TInviteMembersFormSchema>({
    resolver: zodResolver(ZInviteMembersFormSchema),
    defaultValues: fieldNames.reduce((acc, fieldName) => ({ ...acc, [fieldName]: "" }), {}),
  });

  const { isSubmitting } = form.formState;

  const inviteTeamMembers = async (data: TInviteMembersFormSchema) => {
    const emails = Object.values(data).filter((email) => email && email.trim());
    if (!emails.length) {
      router.push("/onboarding");
      return;
    }

    for (const email of emails) {
      try {
        await inviteOrganizationMemberAction(email ?? "");
        toast.success(`Invitation sent to ${email}!`);
      } catch (error) {
        console.error("Failed to invite:", email, error);
        toast.error(`Failed to invite ${email}.`);
      }
    }

    router.push("/onboarding");
  };

  const handleSkip = () => {
    router.push("/onboarding");
  };

  return (
    <FormProvider {...form}>
      {!IS_SMTP_CONFIGURED && (
        <Alert variant="warning">
          <AlertTitle>SMTP not configured</AlertTitle>
          <AlertDescription>
            Invitations cannot be sent at this time because the email service is not configured. You can send
            them later from organization settings
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={form.handleSubmit(inviteTeamMembers)} className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-medium">Invite your Organization members</h2>
          <p>Life&apos;s no fun alone.</p>

          {fieldNames.map((fieldName, index) => (
            <FormField
              key={fieldName}
              control={form.control}
              name={fieldName}
              render={({ field, fieldState: { error } }) => (
                <FormItem>
                  <FormControl>
                    <div>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder={`Member ${index + 1} email`}
                          className="w-80"
                          isInvalid={!!error?.message}
                        />
                        {index === fieldNames.length - 1 && (
                          <PlusIcon
                            className="absolute -right-8 top-2 cursor-pointer text-slate-500"
                            onClick={() =>
                              setFieldNames([...fieldNames, `member${fieldNames.length + 1}Email`])
                            }
                          />
                        )}
                      </div>
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          ))}

          <div className="space-y-2">
            <Button
              variant="darkCTA"
              className="flex w-80 justify-center"
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || !IS_SMTP_CONFIGURED}>
              Continue
            </Button>
            <Button type="button" variant="minimal" className="flex w-80 justify-center" onClick={handleSkip}>
              Skip
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
