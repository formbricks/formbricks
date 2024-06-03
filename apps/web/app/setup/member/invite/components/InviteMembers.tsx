"use client";

import { inviteOrganizationMemberAction } from "@/app/setup/member/invite/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import { TInviteMembersFormSchema, ZInviteMembersFormSchema } from "@formbricks/types/invites";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";

export const InviteMembers = () => {
  const [isSkipping, setIsSkipping] = useState(false);
  const router = useRouter();

  const form = useForm<TInviteMembersFormSchema>({
    resolver: zodResolver(ZInviteMembersFormSchema),
  });

  const { isSubmitting } = form.formState;

  const inviteTeamMembers = async (data: TInviteMembersFormSchema) => {
    const emails = Object.values(data).filter((email) => email && email.trim() !== "");

    if (!emails?.length) {
      router.push("/onboarding");
      return;
    }

    for (const email of emails) {
      try {
        await inviteOrganizationMemberAction(email);
        toast.success(`Invitation sent to members!`);
      } catch (error) {
        console.error("Failed to invite:", email, error);
        toast.error(`Failed to invite members, something went wrong.`);
      }
    }

    router.push("/onboarding");
  };

  const handleSkip = () => {
    setIsSkipping(true);
    router.push("/onboarding");
  };

  // Check if all input fields are empty
  const watchedFields = form.watch();
  const allFieldsEmpty = Object.values(watchedFields).every((value) => value?.trim() === "");

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(inviteTeamMembers)} className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-medium">Invite your Organization members</h2>
          <p>Life&apos;s no fun alone.</p>
          <FormField
            control={form.control}
            name="member1Email"
            render={({ field, fieldState: { error } }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="member1@web.com"
                    className="w-80"
                    isInvalid={!!error?.message}
                  />
                </FormControl>

                <FormError className="text-left" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="member2Email"
            render={({ field, fieldState: { error } }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="member2@web.com"
                    className="w-80"
                    isInvalid={!!error?.message}
                  />
                </FormControl>

                <FormError className="text-left" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="member3Email"
            render={({ field, fieldState: { error } }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="member3@web.com"
                    className="w-80"
                    isInvalid={!!error?.message}
                  />
                </FormControl>

                <FormError className="text-left" />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <Button
              variant="darkCTA"
              className="flex w-80 justify-center"
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || isSkipping || allFieldsEmpty}>
              Continue
            </Button>
            <Button
              type="button"
              variant="minimal"
              className="flex w-80 justify-center"
              onClick={handleSkip}
              loading={isSkipping}>
              Skip
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
