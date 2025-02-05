"use client";

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
import { TProject, ZProject } from "@formbricks/types/project";
import { updateProjectAction } from "../../actions";

interface EditWaitingTimeProps {
  project: TProject;
  isReadOnly: boolean;
}

const ZProjectRecontactDaysInput = ZProject.pick({ recontactDays: true });

type TEditWaitingTimeFormValues = z.infer<typeof ZProjectRecontactDaysInput>;

export const EditWaitingTimeForm: React.FC<EditWaitingTimeProps> = ({ project, isReadOnly }) => {
  const { t } = useTranslate();
  const form = useForm<TEditWaitingTimeFormValues>({
    defaultValues: {
      recontactDays: project.recontactDays,
    },
    resolver: zodResolver(ZProjectRecontactDaysInput),
    mode: "onChange",
  });

  const { isDirty, isSubmitting } = form.formState;

  const updateWaitingTime: SubmitHandler<TEditWaitingTimeFormValues> = async (data) => {
    try {
      const updatedProjectResponse = await updateProjectAction({ projectId: project.id, data });
      if (updatedProjectResponse?.data) {
        toast.success(t("environments.project.general.waiting_period_updated_successfully"));
        form.resetField("recontactDays", { defaultValue: updatedProjectResponse.data.recontactDays });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
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
          className="flex w-full max-w-sm flex-col space-y-4"
          onSubmit={form.handleSubmit(updateWaitingTime)}>
          <FormField
            control={form.control}
            name="recontactDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="recontactDays">
                  {t("environments.project.general.wait_x_days_before_showing_next_survey")}
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

                      field.onChange(parseInt(value, 10));
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
