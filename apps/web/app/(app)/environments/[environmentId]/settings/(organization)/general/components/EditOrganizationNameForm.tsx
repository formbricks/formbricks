"use client";

import { updateOrganizationNameAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization, ZOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/components/Button";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";

interface EditOrganizationNameProps {
  environmentId: string;
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

const ZEditOrganizationNameFormSchema = ZOrganization.pick({ name: true });
type EditOrganizationNameForm = z.infer<typeof ZEditOrganizationNameFormSchema>;

export const EditOrganizationNameForm = ({ organization, membershipRole }: EditOrganizationNameProps) => {
  const t = useTranslations();
  const form = useForm<EditOrganizationNameForm>({
    defaultValues: {
      name: organization.name,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditOrganizationNameFormSchema),
  });

  const { isMember, isBilling } = getAccessFlags(membershipRole);

  const { isSubmitting, isDirty } = form.formState;

  const handleUpdateOrganizationName: SubmitHandler<EditOrganizationNameForm> = async (data) => {
    try {
      const name = data.name.trim();
      const updatedOrganizationResponse = await updateOrganizationNameAction({
        organizationId: organization.id,
        data: { name },
      });

      if (updatedOrganizationResponse?.data) {
        toast.success(t("environments.settings.general.organization_name_updated_successfully"));
        form.reset({ name: updatedOrganizationResponse.data.name });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedOrganizationResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const isMemberOrBilling = isMember || isBilling;

  return isMemberOrBilling ? (
    <p className="text-sm text-red-700">
      {t("environments.settings.general.only_org_owner_can_perform_action")}
    </p>
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
              <FormLabel>{t("environments.settings.general.organization_name")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  isInvalid={!!fieldState.error?.message}
                  placeholder={t("environments.settings.general.organization_name_placeholder")}
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
          {t("common.update")}
        </Button>
      </form>
    </FormProvider>
  );
};
