"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
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
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TProject, ZProject } from "@formbricks/types/project";

interface EditProjectNameProps {
  project: TProject;
  isReadOnly: boolean;
}

const ZProjectNameInput = ZProject.pick({ name: true });

type TEditProjectName = z.infer<typeof ZProjectNameInput>;

export const EditProjectNameForm: React.FC<EditProjectNameProps> = ({ project, isReadOnly }) => {
  const { t } = useTranslate();
  const router = useRouter();
  const form = useForm<TEditProjectName>({
    defaultValues: {
      name: project.name,
    },
    resolver: zodResolver(ZProjectNameInput),
    mode: "onChange",
  });

  const { errors, isDirty } = form.formState;

  const nameError = errors.name?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateProject: SubmitHandler<TEditProjectName> = async (data) => {
    const name = data.name.trim();
    try {
      if (nameError) {
        toast.error(nameError);
        return;
      }

      const updatedProjectResponse = await updateProjectAction({
        projectId: project.id,
        data: {
          name,
        },
      });

      if (updatedProjectResponse?.data) {
        toast.success(t("environments.project.general.project_name_updated_successfully"));
        form.resetField("name", { defaultValue: updatedProjectResponse.data.name });
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error(err);
      toast.error(t("environments.project.general.error_saving_project_information"));
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form className="w-full max-w-sm items-center space-y-2" onSubmit={form.handleSubmit(updateProject)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="name">
                  {t("environments.project.general.whats_your_project_called")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="name"
                    {...field}
                    placeholder={t("common.project_name")}
                    autoComplete="off"
                    required
                    isInvalid={!!nameError}
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
