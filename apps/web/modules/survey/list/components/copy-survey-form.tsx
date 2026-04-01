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

interface EnvironmentCheckboxProps {
  readonly environmentId: string;
  readonly environmentType: string;
  readonly fieldValue: string[];
  readonly onChange: (value: string[]) => void;
}

function EnvironmentCheckbox({
  environmentId,
  environmentType,
  fieldValue,
  onChange,
}: EnvironmentCheckboxProps) {
  const handleCheckedChange = () => {
    if (fieldValue.includes(environmentId)) {
      onChange(fieldValue.filter((id) => id !== environmentId));
    } else {
      onChange([...fieldValue, environmentId]);
    }
  };

  return (
    <FormItem>
      <div className="flex items-center">
        <FormControl>
          <div className="flex items-center">
            <Checkbox
              type="button"
              checked={fieldValue.includes(environmentId)}
              onCheckedChange={handleCheckedChange}
              className="mr-2 h-4 w-4 appearance-none border-slate-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
              id={environmentId}
            />
            <Label htmlFor={environmentId}>
              <p className="text-sm font-medium capitalize text-slate-900">{environmentType}</p>
            </Label>
          </div>
        </FormControl>
      </div>
    </FormItem>
  );
}

interface EnvironmentCheckboxGroupProps {
  readonly workspace: TUserWorkspace;
  readonly form: ReturnType<typeof useForm<TSurveyCopyFormData>>;
  readonly workspaceIndex: number;
}

function EnvironmentCheckboxGroup({ workspace, form, workspaceIndex }: EnvironmentCheckboxGroupProps) {
  return (
    <div className="flex flex-col gap-4">
      {workspace.environments.map((environment) => (
        <FormField
          key={environment.id}
          control={form.control}
          name={`workspaces.${workspaceIndex}.environments`}
          render={({ field }) => (
            <EnvironmentCheckbox
              environmentId={environment.id}
              environmentType={environment.type}
              fieldValue={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ))}
    </div>
  );
}

export const CopySurveyForm = ({ defaultWorkspaces, survey, onCancel, setOpen }: CopySurveyFormProps) => {
  const { t } = useTranslation();

  const filteredWorkspaces = defaultWorkspaces.map((workspace) => ({
    ...workspace,
    environments: workspace.environments.filter((env) => env.id !== survey.environmentId),
  }));

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
          const environment =
            workspace?.environments[0]?.id === environmentId
              ? workspace?.environments[0]
              : workspace?.environments[1];

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
          toast.success(t("environments.surveys.copy_survey_success"));
        } else {
          toast.error(
            t("environments.surveys.copy_survey_partially_success", {
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
    } catch (error) {
      toast.error(t("environments.surveys.copy_survey_error"));
    } finally {
      setOpen(false);
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full w-full flex-col bg-white">
        <div className="flex-1 space-y-8 overflow-y-auto">
          {formFields.fields.map((field, workspaceIndex) => {
            const workspace = filteredWorkspaces.find((workspace) => workspace.id === field.workspace);
            if (!workspace) return null;

            return (
              <div key={workspace.id}>
                <div className="flex flex-col gap-4">
                  <div className="w-fit">
                    <p className="text-base font-semibold text-slate-900">{workspace.name}</p>
                  </div>
                  <EnvironmentCheckboxGroup
                    workspace={workspace}
                    form={form}
                    workspaceIndex={workspaceIndex}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 flex justify-end space-x-2 bg-white pt-4">
          <Button type="button" onClick={onCancel} variant="secondary">
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("environments.surveys.copy_survey")}</Button>
        </div>
      </form>
    </FormProvider>
  );
};
