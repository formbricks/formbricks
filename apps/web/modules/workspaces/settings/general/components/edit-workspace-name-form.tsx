"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TWorkspace, ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
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
import { updateWorkspaceAction } from "@/modules/workspaces/settings/actions";

interface EditWorkspaceNameProps {
  workspace: TWorkspace;
  isReadOnly: boolean;
}

const ZWorkspaceNameInput = ZWorkspaceUpdateInput.pick({ name: true }).required({ name: true });

type TEditWorkspaceName = z.infer<typeof ZWorkspaceNameInput>;

export const EditWorkspaceNameForm: React.FC<EditWorkspaceNameProps> = ({ workspace, isReadOnly }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const form = useForm<TEditWorkspaceName>({
    defaultValues: {
      name: workspace.name,
    },
    resolver: zodResolver(ZWorkspaceNameInput),
    mode: "onChange",
  });

  const { errors, isDirty } = form.formState;

  const nameError = errors.name?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateWorkspace: SubmitHandler<TEditWorkspaceName> = async (data) => {
    const name = data.name.trim();
    try {
      if (nameError) {
        toast.error(nameError);
        return;
      }

      const updatedWorkspaceResponse = await updateWorkspaceAction({
        workspaceId: workspace.id,
        data: {
          name,
        },
      });

      if (updatedWorkspaceResponse?.data) {
        toast.success(t("environments.workspace.general.workspace_name_updated_successfully"));
        form.resetField("name", { defaultValue: updatedWorkspaceResponse.data.name });
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(updatedWorkspaceResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error(err);
      toast.error(t("environments.workspace.general.error_saving_workspace_information"));
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form
          className="w-full max-w-sm items-center space-y-2"
          onSubmit={form.handleSubmit(updateWorkspace)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="name">
                  {t("environments.workspace.general.whats_your_workspace_called")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="name"
                    {...field}
                    placeholder={t("common.workspace_name")}
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
