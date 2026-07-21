"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TWorkspace, ZWorkspace } from "@formbricks/types/workspace";
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
import { updateWorkspaceAction } from "../../actions";

interface EditCooldownPeriodProps {
  workspace: TWorkspace;
  isReadOnly: boolean;
}

const ZWorkspaceRecontactDaysInput = ZWorkspace.pick({ recontactDays: true });

type TEditCooldownPeriodFormValues = z.infer<typeof ZWorkspaceRecontactDaysInput>;

export const EditCooldownPeriodForm: React.FC<EditCooldownPeriodProps> = ({ workspace, isReadOnly }) => {
  const { t } = useTranslation();
  const form = useForm<TEditCooldownPeriodFormValues>({
    defaultValues: {
      recontactDays: workspace.recontactDays,
    },
    resolver: zodResolver(ZWorkspaceRecontactDaysInput),
    mode: "onChange",
  });

  const { isDirty, isSubmitting } = form.formState;

  const updateCooldownPeriod: SubmitHandler<TEditCooldownPeriodFormValues> = async (data) => {
    try {
      const updatedWorkspaceResponse = await updateWorkspaceAction({ workspaceId: workspace.id, data });
      if (updatedWorkspaceResponse?.data) {
        toast.success(t("workspace.general.cooldown_period_updated_successfully"));
        form.resetField("recontactDays", { defaultValue: updatedWorkspaceResponse.data.recontactDays });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedWorkspaceResponse);
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
          className="flex w-full max-w-sm flex-col gap-y-4"
          onSubmit={form.handleSubmit(updateCooldownPeriod)}>
          <FormField
            control={form.control}
            name="recontactDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="recontactDays">
                  {t("workspace.general.wait_x_days_before_showing_next_survey")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    id="recontactDays"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        field.onChange("");
                      }

                      field.onChange(Number.parseInt(value, 10));
                    }}
                    disabled={isReadOnly}
                  />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="sm"
            className="w-fit"
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty || isReadOnly}>
            {t("common.update")}
          </Button>
        </form>
      </FormProvider>
      {isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
