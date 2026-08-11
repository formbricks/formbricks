"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization, ZOrganization, ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import {
  updateOrganizationDisplayTimeZoneAction,
  updateOrganizationNameAction,
} from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/actions";
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
import { Input } from "@/modules/ui/components/input";
import { InputCombobox, TComboboxOption } from "@/modules/ui/components/input-combo-box";

interface EditOrganizationSettingsFormProps {
  organization: TOrganization;
  membershipRole?: TOrganizationRole;
}

const ZEditOrganizationSettingsFormSchema = ZOrganization.pick({ name: true }).merge(
  ZOrganizationUpdateInput.pick({ displayTimeZone: true })
);
type TEditOrganizationSettingsForm = z.infer<typeof ZEditOrganizationSettingsFormSchema>;

// Sentinel combobox value representing the default (null in the database, rendered as UTC).
const UTC_DEFAULT_OPTION_VALUE = "UTC";

const IANA_TIME_ZONES = Intl.supportedValuesOf("timeZone").filter(
  (timeZone) => timeZone !== UTC_DEFAULT_OPTION_VALUE
);

export const EditOrganizationSettingsForm = ({
  organization,
  membershipRole,
}: Readonly<EditOrganizationSettingsFormProps>) => {
  const { t } = useTranslation();
  const form = useForm<TEditOrganizationSettingsForm>({
    defaultValues: {
      name: organization.name,
      displayTimeZone: organization.displayTimeZone ?? null,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditOrganizationSettingsFormSchema),
  });

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  // Name is owner-only; display time zone can also be edited by managers.
  const canEditTimeZone = isOwner || isManager;

  const { isSubmitting, isDirty, dirtyFields } = form.formState;

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

  const handleUpdateOrganizationSettings: SubmitHandler<TEditOrganizationSettingsForm> = async (data) => {
    try {
      // Only persist the fields the user changed and is allowed to change.
      if (dirtyFields.name && isOwner) {
        const name = data.name.trim();
        const response = await updateOrganizationNameAction({
          organizationId: organization.id,
          data: { name },
        });

        if (response?.data) {
          toast.success(t("workspace.settings.general.organization_name_updated_successfully"));
          form.resetField("name", { defaultValue: response.data.name });
        } else {
          toast.error(getFormattedErrorMessage(response));
        }
      }

      if (dirtyFields.displayTimeZone && canEditTimeZone) {
        const displayTimeZone = data.displayTimeZone ?? null;
        const response = await updateOrganizationDisplayTimeZoneAction({
          organizationId: organization.id,
          data: { displayTimeZone },
        });

        if (response?.data) {
          toast.success(t("workspace.settings.general.display_time_zone_updated_successfully"));
          form.resetField("displayTimeZone", { defaultValue: response.data.displayTimeZone ?? null });
        } else {
          toast.error(getFormattedErrorMessage(response));
        }
      }
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : "Unknown error occurred"}`);
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form
          className="w-full max-w-sm space-y-4"
          onSubmit={form.handleSubmit(handleUpdateOrganizationSettings)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("workspace.settings.general.organization_name")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    disabled={!isOwner}
                    isInvalid={!!fieldState.error?.message}
                    placeholder={t("workspace.settings.general.organization_name_placeholder")}
                    required
                  />
                </FormControl>

                <FormError />
              </FormItem>
            )}
          />

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
                    disabled={!canEditTimeZone}
                  />
                </FormControl>

                <FormError />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="sm"
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty || (!isOwner && !canEditTimeZone)}>
            {t("common.update")}
          </Button>
        </form>
      </FormProvider>
      {!canEditTimeZone && (
        <Alert variant="warning" className="mt-4" role="status">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
