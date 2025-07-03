"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { TSurvey, TSurveyCopyFormData, ZSurveyCopyFormValidation } from "@/modules/survey/list/types/surveys";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Label } from "@/modules/ui/components/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { AlertCircleIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";

interface CopySurveyFormProps {
  readonly defaultProjects: TUserProject[];
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
  readonly project: TUserProject;
  readonly form: ReturnType<typeof useForm<TSurveyCopyFormData>>;
  readonly projectIndex: number;
}

function EnvironmentCheckboxGroup({ project, form, projectIndex }: EnvironmentCheckboxGroupProps) {
  return (
    <div className="flex flex-col gap-4">
      {project.environments.map((environment) => (
        <FormField
          key={environment.id}
          control={form.control}
          name={`projects.${projectIndex}.environments`}
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

export const CopySurveyForm = ({ defaultProjects, survey, onCancel, setOpen }: CopySurveyFormProps) => {
  const { t } = useTranslate();

  const filteredProjects = defaultProjects.map((project) => ({
    ...project,
    environments: project.environments.filter((env) => env.id !== survey.environmentId),
  }));

  const form = useForm<TSurveyCopyFormData>({
    resolver: zodResolver(ZSurveyCopyFormValidation),
    defaultValues: {
      projects: filteredProjects.map((project) => ({
        project: project.id,
        environments: [],
      })),
    },
  });

  const formFields = useFieldArray({
    name: "projects",
    control: form.control,
  });

  async function onSubmit(data: TSurveyCopyFormData) {
    const filteredData = data.projects.filter((project) => project.environments.length > 0);

    try {
      const copyOperationsWithMetadata = filteredData.flatMap((projectData) => {
        const project = filteredProjects.find((p) => p.id === projectData.project);
        return projectData.environments.map((environmentId) => {
          const environment =
            project?.environments[0]?.id === environmentId
              ? project?.environments[0]
              : project?.environments[1];

          return {
            operation: copySurveyToOtherEnvironmentAction({
              environmentId: survey.environmentId,
              surveyId: survey.id,
              targetEnvironmentId: environmentId,
            }),
            projectName: project?.name ?? "Unknown Project",
            environmentType: environment?.type ?? "unknown",
            environmentId,
          };
        });
      });

      const results = await Promise.all(copyOperationsWithMetadata.map((item) => item.operation));

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
          const { projectName, environmentType } = copyOperationsWithMetadata[index];
          const result = results[index];

          const errorMessage = getFormattedErrorMessage(result);
          toast.error(`[${projectName}] - [${environmentType}] - ${errorMessage}`, {
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="relative flex h-full w-full flex-col gap-8 overflow-y-auto bg-white p-4">
        <div className="space-y-8 pb-12">
          {formFields.fields.map((field, projectIndex) => {
            const project = filteredProjects.find((project) => project.id === field.project);
            if (!project) return null;

            return (
              <div key={project.id}>
                <div className="flex flex-col gap-4">
                  <div className="w-fit">
                    <p className="text-base font-semibold text-slate-900">{project.name}</p>
                  </div>
                  <EnvironmentCheckboxGroup project={project} form={form} projectIndex={projectIndex} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-10 flex w-full justify-end space-x-2 bg-white">
          <div className="flex w-full justify-end pb-4 pr-4">
            <Button type="button" onClick={onCancel} variant="ghost">
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("environments.surveys.copy_survey")}</Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
