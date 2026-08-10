"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization, ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import { updateOrganizationDisplayTimeZoneAction } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/actions";
import { getAccessFlags } from "@/lib/membership/utils";
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
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";

interface EditOrganizationDisplayTimeZoneFormProps {
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

const ZEditOrganizationDisplayTimeZoneFormSchema = ZOrganizationUpdateInput.pick({ displayTimeZone: true });
type TEditOrganizationDisplayTimeZoneForm = z.infer<typeof ZEditOrganizationDisplayTimeZoneFormSchema>;

// Sentinel combobox value representing the default (null in the database, rendered as UTC).
const UTC_DEFAULT_OPTION_VALUE = "UTC";

const IANA_TIME_ZONES = Intl.supportedValuesOf("timeZone").filter(
  (timeZone) => timeZone !== UTC_DEFAULT_OPTION_VALUE
);

export const EditOrganizationDisplayTimeZoneForm = ({
  organization,
  membershipRole,
}: Readonly<EditOrganizationDisplayTimeZoneFormProps>) => {
  const { t } = useTranslation();
  const form = useForm<TEditOrganizationDisplayTimeZoneForm>({
    defaultValues: {
      displayTimeZone: organization.displayTimeZone ?? null,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditOrganizationDisplayTimeZoneFormSchema),
  });

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const canEdit = isOwner || isManager;

  const { isSubmitting, isDirty } = form.formState;

  const timeZoneOptions = useMemo<TComboboxOption[]>(
    () => [
      {
        label: t("workspace.settings.general.display_time_zone_utc_default"),
        value: UTC_DEFAULT_OPTION_VALUE,
      },
      ...IANA_TIME_ZONES.map((timeZone) => ({ label: timeZone, value: timeZone })),
    ],
    [t]
  );

  const handleUpdateDisplayTimeZone: SubmitHandler<TEditOrganizationDisplayTimeZoneForm> = async (data) => {
    try {
      const displayTimeZone = data.displayTimeZone ?? null;
      const updatedOrganizationResponse = await updateOrganizationDisplayTimeZoneAction({
        organizationId: organization.id,
        data: { displayTimeZone },
      });

      if (updatedOrganizationResponse?.data) {
        toast.success(t("workspace.settings.general.display_time_zone_updated_successfully"));
        form.reset({ displayTimeZone: updatedOrganizationResponse.data.displayTimeZone ?? null });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedOrganizationResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form
          className="w-full max-w-sm items-center"
          onSubmit={form.handleSubmit(handleUpdateDisplayTimeZone)}>
          <FormField
            control={form.control}
            name="displayTimeZone"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="display-time-zone">
                  {t("workspace.settings.general.display_time_zone")}
                </FormLabel>
                <FormControl>
                  <InputCombobox
                    id="display-time-zone"
                    // The trigger renders as div[role="combobox"], which <label htmlFor> can't name;
                    // give it an explicit accessible name matching the visible FormLabel.
                    aria-label={t("workspace.settings.general.display_time_zone")}
                    showSearch
                    options={timeZoneOptions}
                    value={field.value ?? UTC_DEFAULT_OPTION_VALUE}
                    onChangeValue={(value) => {
                      field.onChange(value === UTC_DEFAULT_OPTION_VALUE ? null : String(value));
                    }}
                    placeholder={t("workspace.settings.general.display_time_zone_placeholder")}
                    disabled={!canEdit}
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
            disabled={isSubmitting || !isDirty || !canEdit}>
            {t("common.update")}
          </Button>
        </form>
      </FormProvider>
      {!canEdit && (
        <Alert variant="warning" className="mt-4" role="status">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
