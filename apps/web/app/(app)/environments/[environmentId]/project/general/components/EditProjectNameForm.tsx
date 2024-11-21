"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TProject, ZProject } from "@formbricks/types/project";
import { Alert, AlertDescription } from "@formbricks/ui/components/Alert";
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
import { updateProjectAction } from "../../actions";

type EditProjectNameProps = {
  project: TProject;
  isReadOnly: boolean;
};

const ZProjectNameInput = ZProject.pick({ name: true });

type TEditProjectName = z.infer<typeof ZProjectNameInput>;

export const EditProjectNameForm: React.FC<EditProjectNameProps> = ({ project, isReadOnly }) => {
  const t = useTranslations();
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
        toast.success(t("environments.project.general.product_name_updated_successfully"));
        form.resetField("name", { defaultValue: updatedProjectResponse.data.name });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error: Unable to save project information`);
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
                  {t("environments.project.general.whats_your_product_called")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="name"
                    {...field}
                    placeholder={t("common.product_name")}
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
