"use client";

import { updateOrganizationNameAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TOrganization, ZOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem, FormLabel, FormProvider } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";

interface EditOrganizationNameProps {
  environmentId: string;
  organization: TOrganization;
  membershipRole?: TMembershipRole;
}

const ZEditOrganizationNameFormSchema = ZOrganization.pick({ name: true });
type EditOrganizationNameForm = z.infer<typeof ZEditOrganizationNameFormSchema>;

export const EditOrganizationNameForm = ({ organization, membershipRole }: EditOrganizationNameProps) => {
  const form = useForm<EditOrganizationNameForm>({
    defaultValues: {
      name: organization.name,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditOrganizationNameFormSchema),
  });

  const { isViewer } = getAccessFlags(membershipRole);

  const { isSubmitting, isDirty } = form.formState;

  const handleUpdateOrganizationName: SubmitHandler<EditOrganizationNameForm> = async (data) => {
    try {
      const name = data.name.trim();
      const updatedOrganizationResponse = await updateOrganizationNameAction({
        organizationId: organization.id,
        data: { name },
      });

      if (updatedOrganizationResponse?.data) {
        toast.success("Organization name updated successfully.");
        form.reset({ name: updatedOrganizationResponse.data.name });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedOrganizationResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return isViewer ? (
    <p className="text-sm text-red-700">You are not authorized to perform this action.</p>
  ) : (
    <FormProvider {...form}>
      <form
        className="w-full max-w-sm items-center"
        onSubmit={form.handleSubmit(handleUpdateOrganizationName)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  isInvalid={!!fieldState.error?.message}
                  placeholder="Organization Name"
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
          Update
        </Button>
      </form>
    </FormProvider>
  );
};
