"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization, ZOrganization, ZOrganizationUpdateInput } from "@formbricks/types/organizations";
import { updateOrganizationSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/lib/api-client";
import type { TOrganizationPatchBody } from "@/app/api/internal/organizations/schemas";
import type { TOrganizationSettingsResource } from "@/app/api/internal/organizations/serializers";
import { getAccessFlags } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormDescription,
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

const ZEditOrganizationSettingsFormSchema = ZOrganization.pick({ name: true }).extend(
  ZOrganizationUpdateInput.pick({ displayTimeZone: true }).shape
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
  const router = useRouter();
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

  /** Send one field; a failure is reported and leaves the other field's update to go ahead. */
  const saveField = async (
    body: TOrganizationPatchBody,
    successMessage: string
  ): Promise<TOrganizationSettingsResource | null> => {
    try {
      const settings = await updateOrganizationSettings(organization.id, body);
      toast.success(successMessage);
      return settings;
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      return null;
    }
  };

  const handleUpdateOrganizationSettings: SubmitHandler<TEditOrganizationSettingsForm> = async (data) => {
    // Only persist the fields the user changed and is allowed to change. They have different permissions,
    // so each goes on its own and reports on its own.
    if (dirtyFields.name && isOwner) {
      const settings = await saveField(
        { name: data.name.trim() },
        t("workspace.settings.general.organization_name_updated_successfully")
      );
      if (settings) {
        form.resetField("name", { defaultValue: settings.name });
        // Re-render the server layouts so the breadcrumb and sidebar pick up the new name.
        router.refresh();
      }
    }

    if (dirtyFields.displayTimeZone && canEditTimeZone) {
      const settings = await saveField(
        { displayTimeZone: data.displayTimeZone ?? null },
        t("workspace.settings.general.display_time_zone_updated_successfully")
      );
      if (settings) form.resetField("displayTimeZone", { defaultValue: settings.displayTimeZone });
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form
          className="w-full max-w-md space-y-4"
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

                <FormDescription className="w-full">
                  {t("workspace.settings.general.display_time_zone_description")}
                </FormDescription>
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
