"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon, Loader2, MousePointerClickIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { getWritableWorkspacesAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { copySurveyToOtherWorkspaceAction } from "@/modules/survey/list/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";

interface CopySurveyModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  surveyId: string;
  currentWorkspaceId: string;
  organizationId: string;
}

const ZCopySurveyFormValidation = z.object({
  workspaceIds: z.array(z.string()).min(1),
});

type TCopySurveyFormData = z.infer<typeof ZCopySurveyFormValidation>;

export const CopySurveyModal = ({
  open,
  setOpen,
  surveyId,
  currentWorkspaceId,
  organizationId,
}: CopySurveyModalProps) => {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);

  const form = useForm<TCopySurveyFormData>({
    resolver: zodResolver(ZCopySurveyFormValidation),
    defaultValues: { workspaceIds: [] },
  });

  useEffect(() => {
    if (!open) return;
    setWorkspacesLoading(true);
    form.reset({ workspaceIds: [] });
    getWritableWorkspacesAction({ organizationId })
      .then((result) => {
        if (result?.data) {
          const eligible = result.data
            .filter((w) => w.id !== currentWorkspaceId)
            .sort((a, b) => a.name.localeCompare(b.name));
          setWorkspaces(eligible);
        } else {
          toast.error(getFormattedErrorMessage(result) || t("common.something_went_wrong_please_try_again"));
        }
      })
      .catch((error) => {
        logger.error(error);
        toast.error(t("common.something_went_wrong_please_try_again"));
      })
      .finally(() => {
        setWorkspacesLoading(false);
      });
  }, [open, organizationId, currentWorkspaceId, t, form]);

  const onSubmit = async (data: TCopySurveyFormData) => {
    try {
      const results: Awaited<ReturnType<typeof copySurveyToOtherWorkspaceAction>>[] = [];
      for (const targetWorkspaceId of data.workspaceIds) {
        const result = await copySurveyToOtherWorkspaceAction({
          surveyId,
          targetWorkspaceId,
        });
        results.push(result);
      }

      let successCount = 0;
      const errorsIndexes: number[] = [];

      results.forEach((result, index) => {
        if (result?.data) {
          successCount++;
        } else {
          errorsIndexes.push(index);
        }
      });

      const errorCount = errorsIndexes.length;

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
          const targetWorkspaceId = data.workspaceIds[index];
          const workspaceName = workspaces.find((w) => w.id === targetWorkspaceId)?.name ?? targetWorkspaceId;
          const errorMessage =
            getFormattedErrorMessage(results[index]) || t("workspace.surveys.copy_survey_error");
          toast.error(`[${workspaceName}] - ${errorMessage}`, {
            duration: 2000 + 2000 * idx,
          });
        });
      }
    } catch (error) {
      logger.error(error);
      toast.error(t("workspace.surveys.copy_survey_error"));
    } finally {
      setOpen(false);
    }
  };

  const workspaceOptions = workspaces.map((w) => ({ value: w.id, label: w.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[600px]">
        <DialogHeader>
          <MousePointerClickIcon />
          <DialogTitle>{t("workspace.surveys.copy_survey")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.copy_survey_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody unconstrained className="p-1">
          {workspacesLoading ? (
            <div className="relative flex h-full min-h-96 w-full items-center justify-center bg-white pb-12">
              <Loader2 className="animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-sm text-slate-600">
              {t("workspace.surveys.no_other_workspaces_available")}
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full w-full flex-col bg-white">
              <div className="mb-2 flex-1 space-y-2">
                <Label htmlFor="copy-survey-workspaces">
                  {t("workspace.surveys.copy_survey_target_workspaces_label")}
                </Label>
                <Controller
                  control={form.control}
                  name="workspaceIds"
                  render={({ field }) => (
                    <MultiSelect
                      options={workspaceOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t("workspace.surveys.copy_survey_select_workspaces_placeholder")}
                    />
                  )}
                />
              </div>
              <div className="sticky bottom-0 flex justify-end space-x-2 bg-white pt-4">
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  variant="secondary"
                  disabled={form.formState.isSubmitting}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  loading={form.formState.isSubmitting}
                  disabled={form.watch("workspaceIds").length === 0}>
                  {t("workspace.surveys.copy_survey")}
                </Button>
              </div>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
