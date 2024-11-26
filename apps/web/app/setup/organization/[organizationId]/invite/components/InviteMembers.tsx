"use client";

import { inviteOrganizationMemberAction } from "@/app/setup/organization/[organizationId]/invite/actions";
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
  organizationId: string;
}

export const InviteMembers = ({ IS_SMTP_CONFIGURED, organizationId }: InviteMembersProps) => {
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
          toast.success(`Invitation sent to ${email}!`);
        }
      } catch (error) {
        console.error("Failed to invite:", email, error);
        toast.error(`Failed to invite ${email}.`);
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
          <AlertTitle>SMTP not configured</AlertTitle>
          <AlertDescription>
            Invitations cannot be sent at this time because the email service is not configured. You can copy
            the invite link in the organization settings later.
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={form.handleSubmit(inviteTeamMembers)} className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-medium">Invite your Organization members</h2>
          <p>Life&apos;s no fun alone.</p>

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

          <Button
            variant="minimal"
            onClick={() => setMembersCount((count) => count + 1)}
            type="button"
            StartIcon={PlusIcon}>
            Add another member
          </Button>

          <hr className="my-6 w-full border-slate-200" />

          <div className="space-y-2">
            <Button
              className="flex w-80 justify-center"
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}>
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
