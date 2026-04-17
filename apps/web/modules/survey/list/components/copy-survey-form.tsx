"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { copySurveyToOtherWorkspaceAction } from "@/modules/survey/list/actions";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { TUserWorkspace } from "@/modules/survey/list/types/workspaces";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { FormControl, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Label } from "@/modules/ui/components/label";

const ZCopyFormData = z.object({
  selectedWorkspaceIds: z.array(z.string()),
});

type TCopyFormData = z.infer<typeof ZCopyFormData>;

interface CopySurveyFormProps {
  readonly defaultWorkspaces: TUserWorkspace[];
  readonly survey: TSurvey;
  readonly onCancel: () => void;
  readonly setOpen: (value: boolean) => void;
}

export const CopySurveyForm = ({ defaultWorkspaces, survey, onCancel, setOpen }: CopySurveyFormProps) => {
  const { t } = useTranslation();

  // Filter out the current survey's workspace so you can't copy to the same workspace
  const filteredWorkspaces = defaultWorkspaces.filter((ws) => ws.id !== survey.workspaceId);

  const form = useForm<TCopyFormData>({
    resolver: zodResolver(ZCopyFormData),
    defaultValues: {
      selectedWorkspaceIds: [],
    },
  });

  const { control, handleSubmit } = form;

  async function onSubmit(data: TCopyFormData) {
    try {
      const results: Awaited<ReturnType<typeof copySurveyToOtherWorkspaceAction>>[] = [];

      for (const targetWorkspaceId of data.selectedWorkspaceIds) {
        const result = await copySurveyToOtherWorkspaceAction({
          surveyId: survey.id,
          targetWorkspaceId,
        });
        results.push(result);
      }

      let successCount = 0;
      let errorCount = 0;

      results.forEach((result) => {
        if (result?.data) {
          successCount++;
        } else {
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
            })
          );
        }
      }

      results.forEach((result, idx) => {
        if (!result?.data) {
          const errorMessage = getFormattedErrorMessage(result);
          const ws = filteredWorkspaces[idx];
          toast.error(`[${ws?.name ?? "Unknown"}] - ${errorMessage}`, {
            duration: 2000 + 2000 * idx,
          });
        }
      });
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full w-full flex-col bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto">
          <FormField
            control={control}
            name="selectedWorkspaceIds"
            render={({ field: formField }) => (
              <>
                {filteredWorkspaces.map((workspace) => (
                  <FormItem key={workspace.id}>
                    <div className="flex items-center">
                      <FormControl>
                        <div className="flex items-center">
                          <Checkbox
                            type="button"
                            checked={formField.value.includes(workspace.id)}
                            onCheckedChange={() => {
                              if (formField.value.includes(workspace.id)) {
                                formField.onChange(formField.value.filter((id) => id !== workspace.id));
                              } else {
                                formField.onChange([...formField.value, workspace.id]);
                              }
                            }}
                            className="mr-2 h-4 w-4 appearance-none border-slate-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                            id={workspace.id}
                          />
                          <Label htmlFor={workspace.id}>
                            <p className="text-sm font-medium text-slate-900">{workspace.name}</p>
                          </Label>
                        </div>
                      </FormControl>
                    </div>
                  </FormItem>
                ))}
              </>
            )}
          />
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
