"use client";

import { updateOrganizationNameAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization, ZOrganization } from "@formbricks/types/organizations";

interface EditOrganizationNameProps {
  environmentId: string;
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

const ZEditOrganizationNameFormSchema = ZOrganization.pick({ name: true });
type EditOrganizationNameForm = z.infer<typeof ZEditOrganizationNameFormSchema>;

export const EditOrganizationNameForm = ({ organization, membershipRole }: EditOrganizationNameProps) => {
  const { t } = useTranslate();
  const form = useForm<EditOrganizationNameForm>({
    defaultValues: {
      name: organization.name,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditOrganizationNameFormSchema),
  });

  const { isOwner } = getAccessFlags(membershipRole);

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

  return (
    <>
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
                    disabled={!isOwner}
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
            disabled={isSubmitting || !isDirty || !isOwner}>
            {t("common.update")}
          </Button>
        </form>
      </FormProvider>
      {!isOwner && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("environments.settings.general.only_org_owner_can_perform_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
