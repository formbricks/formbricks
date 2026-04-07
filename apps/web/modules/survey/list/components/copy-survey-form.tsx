"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { TSurvey, TSurveyCopyFormData, ZSurveyCopyFormValidation } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Label } from "@/modules/ui/components/label";

interface CopySurveyFormProps {
  readonly defaultWorkspaces: TUserWorkspace[];
  readonly survey: TSurvey;
  readonly onCancel: () => void;
  readonly setOpen: (value: boolean) => void;
}

export const CopySurveyForm = ({ defaultWorkspaces, survey, onCancel, setOpen }: CopySurveyFormProps) => {
  const { t } = useTranslation();

  // Filter out the current survey's environment so you can't copy to yourself
  const filteredWorkspaces = defaultWorkspaces
    .map((workspace) => ({
      ...workspace,
      environments: workspace.environments.filter((env) => env.id !== survey.environmentId),
    }))
    .filter((workspace) => workspace.environments.length > 0);

  const form = useForm<TSurveyCopyFormData>({
    resolver: zodResolver(ZSurveyCopyFormValidation),
    defaultValues: {
      workspaces: filteredWorkspaces.map((workspace) => ({
        workspace: workspace.id,
        environments: [],
      })),
    },
  });

  const formFields = useFieldArray({
    name: "workspaces",
    control: form.control,
  });

  async function onSubmit(data: TSurveyCopyFormData) {
    const filteredData = data.workspaces.filter((workspace) => workspace.environments.length > 0);

    try {
      const copyOperationsWithMetadata = filteredData.flatMap((workspaceData) => {
        const workspace = filteredWorkspaces.find((p) => p.id === workspaceData.workspace);
        return workspaceData.environments.map((environmentId) => {
          const environment = workspace?.environments.find((env) => env.id === environmentId);

          return {
            workspaceName: workspace?.name ?? "Unknown Workspace",
            environmentType: environment?.type ?? "unknown",
            environmentId,
          };
        });
      });

      const results: Awaited<ReturnType<typeof copySurveyToOtherEnvironmentAction>>[] = [];
      for (const item of copyOperationsWithMetadata) {
        const result = await copySurveyToOtherEnvironmentAction({
          surveyId: survey.id,
          targetEnvironmentId: item.environmentId,
        });
        results.push(result);
      }

      let successCount = 0;
      let errorCount = 0;
      const errorsIndexes: number[] = [];

      results.forEach((result, index) => {
        if (result?.data) {
          successCount++;
        } else {
          errorsIndexes.push(index);
          errorCount++;
        }
      });

      if (successCount > 0) {
        if (errorCount === 0) {
          toast.success(t("workspace.surveys.copy_survey_success"));
        } else {
          toast.error(
            t("workspace.surveys.copy_survey_partially_success", {
              success: successCount,
              error: errorCount,
            }),
            {
              icon: <AlertCircleIcon className="h-5 w-5 text-orange-500" />,
            }
          );
        }
      }

      if (errorsIndexes.length > 0) {
        errorsIndexes.forEach((index, idx) => {
          const { workspaceName, environmentType } = copyOperationsWithMetadata[index];
          const result = results[index];

          const errorMessage = getFormattedErrorMessage(result);
          toast.error(`[${workspaceName}] - [${environmentType}] - ${errorMessage}`, {
            duration: 2000 + 2000 * idx,
          });
        });
      }
    } catch {
      toast.error(t("workspace.surveys.copy_survey_error"));
    } finally {
      setOpen(false);
    }
  }

  if (filteredWorkspaces.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-slate-500">{t("workspace.surveys.copy_survey_no_workspaces")}</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full w-full flex-col bg-white">
        <div className="flex-1 space-y-8 overflow-y-auto">
          {formFields.fields.map((field, workspaceIndex) => {
            const workspace = filteredWorkspaces.find((w) => w.id === field.workspace);
            if (!workspace) return null;

            const environment = workspace.environments[0];
            if (!environment) return null;

            return (
              <FormField
                key={workspace.id}
                control={form.control}
                name={`workspaces.${workspaceIndex}.environments`}
                render={({ field: formField }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormControl>
                        <div className="flex items-center">
                          <Checkbox
                            type="button"
                            checked={formField.value.includes(environment.id)}
                            onCheckedChange={() => {
                              if (formField.value.includes(environment.id)) {
                                formField.onChange(formField.value.filter((id) => id !== environment.id));
                              } else {
                                formField.onChange([...formField.value, environment.id]);
                              }
                            }}
                            className="mr-2 h-4 w-4 appearance-none border-slate-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                            id={environment.id}
                          />
                          <Label htmlFor={environment.id}>
                            <p className="text-sm font-medium text-slate-900">{workspace.name}</p>
                          </Label>
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            );
          })}
        </div>
        <div className="sticky bottom-0 flex justify-end space-x-2 bg-white pt-4">
          <Button type="button" onClick={onCancel} variant="secondary">
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("workspace.surveys.copy_survey")}</Button>
        </div>
      </form>
    </FormProvider>
  );
};
