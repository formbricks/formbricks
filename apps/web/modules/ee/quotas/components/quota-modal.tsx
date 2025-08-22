"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createQuotaAction, updateQuotaAction } from "@/modules/ee/quotas/actions";
import { EndingCardSelector } from "@/modules/ee/quotas/components/ending-card-selector";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { PieChart, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import {
  TSurveyQuota,
  TSurveyQuotaConditions,
  TSurveyQuotaCreateInput,
  TSurveyQuotaUpdateInput,
  ZSurveyQuota,
} from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuotaConditionBuilder } from "./quota-condition-builder";

// Enhanced validation schema for quota form
const quotaFormSchema = ZSurveyQuota.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
}).superRefine((data, ctx) => {
  // Validate ending card when action is endSurvey
  if (data.action === "endSurvey" && (data.endingCardId === null || data.endingCardId === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["action"],
    });
  }
});

type QuotaFormData = z.infer<typeof quotaFormSchema>;

interface QuotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: TSurvey;
  deleteQuota: (quota: TSurveyQuota) => void;
  quota?: TSurveyQuota | null;
  onClose: () => void;
}

export const QuotaModal = ({ open, onOpenChange, survey, quota, deleteQuota, onClose }: QuotaModalProps) => {
  const router = useRouter();
  const isEditing = !!quota;
  const { t } = useTranslate();
  const defaultValues = useMemo(() => {
    return {
      name: quota?.name || "New Quota",
      limit: quota?.limit || 1,
      conditions: quota?.conditions || {
        connector: "and",
        criteria: [
          {
            id: createId(),
            leftOperand: { type: "question", value: survey.questions[0]?.id },
            operator: "equals",
          },
        ],
      },
      action: quota?.action || "endSurvey",
      endingCardId: quota?.endingCardId || null,
      countPartialSubmissions: quota?.countPartialSubmissions || false,
    };
  }, [quota]);

  const form = useForm<QuotaFormData>({
    defaultValues,
    resolver: zodResolver(quotaFormSchema),
    mode: "onSubmit",
    criteriaMode: "all",
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, isDirty, isValid },
  } = form;

  // Watch form values for conditional logic
  const action = watch("action");

  const handleQuotaCreated = async (quota: TSurveyQuotaCreateInput) => {
    const createQuotaActionResult = await createQuotaAction({
      quota: quota,
    });
    if (createQuotaActionResult?.data) {
      toast.success(t("environments.surveys.edit.quotas.quota_created_successfull_toast"));
      router.refresh();
      onClose();
    } else {
      const errorMessage = getFormattedErrorMessage(createQuotaActionResult);
      toast.error(errorMessage);
    }
  };

  const handleQuotaUpdate = async (updatedQuota: TSurveyQuotaUpdateInput, quotaId: string) => {
    const updateQuotaActionResult = await updateQuotaAction({
      quotaId,
      quota: updatedQuota,
    });
    if (updateQuotaActionResult?.data) {
      toast.success(t("environments.surveys.edit.quotas.quota_updated_successfull_toast"));
      router.refresh();
      onClose();
    } else {
      const errorMessage = getFormattedErrorMessage(updateQuotaActionResult);
      toast.error(errorMessage);
    }
  };

  // Handle form submission
  const onSubmit = useCallback(
    async (data: QuotaFormData) => {
      if (!quota) {
        await handleQuotaCreated({
          surveyId: survey.id,
          name: data.name.trim(),
          limit: data.limit,
          conditions: data.conditions,
          action: data.action,
          endingCardId: data.endingCardId || null,
          countPartialSubmissions: data.countPartialSubmissions,
        });
      } else {
        await handleQuotaUpdate(
          {
            name: data.name.trim(),
            limit: data.limit,
            conditions: data.conditions,
            action: data.action,
            endingCardId: data.endingCardId || null,
            countPartialSubmissions: data.countPartialSubmissions,
          },
          quota.id
        );
      }
    },
    [quota, survey.id, handleQuotaCreated, handleQuotaUpdate]
  );

  const handleConditionsChange = useCallback(
    (newConditions: TSurveyQuotaConditions) => {
      form.setValue("conditions", newConditions, { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const quotaActions = [
    {
      label: t("environments.surveys.edit.quotas.end_survey_for_matching_participants"),
      value: "endSurvey",
    },
    {
      label: t("environments.surveys.edit.quotas.continue_survey_normally"),
      value: "continueSurvey",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <FormProvider {...form}>
          <DialogHeader>
            <PieChart className="h-5 w-5" />
            <DialogTitle>
              {isEditing
                ? t("environments.surveys.edit.quotas.edit_quota")
                : t("environments.surveys.edit.quotas.new_quota")}
            </DialogTitle>
            <DialogDescription>{t("common.quotas_description")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6 px-1">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Quota Name Field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.label")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("environments.surveys.edit.quotas.quota_name_placeholder")}
                        className="bg-white"
                        autoFocus={!isEditing}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Quota Limit Field */}
              <FormField
                control={form.control}
                name="limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("environments.surveys.edit.quotas.response_limit")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          className="w-32 bg-white"
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? 0 : parseInt(value, 10));
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              field.onChange(1);
                            }
                            field.onBlur();
                          }}
                        />
                        <span className="text-sm text-slate-500">{t("common.response_s")}</span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Inclusion Criteria Field */}
              <FormField
                control={form.control}
                name="conditions"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-4 rounded-lg bg-slate-50 p-3">
                      <FormLabel>{t("environments.surveys.edit.quotas.inclusion_criteria")}</FormLabel>
                      <FormControl>
                        {field.value && (
                          <QuotaConditionBuilder
                            survey={survey}
                            conditions={field.value}
                            onChange={handleConditionsChange}
                            hideRemoveButton={field.value.criteria.length === 1}
                          />
                        )}
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {/* Quota Action Fields */}
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>{t("environments.surveys.edit.quotas.when_quota_has_been_reached")}</FormLabel>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-2">
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select action" />
                            </SelectTrigger>
                            <SelectContent>
                              {quotaActions.map((action) => (
                                <SelectItem key={action.value} value={action.value}>
                                  {action.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </div>

                      {action === "endSurvey" && (
                        <FormField
                          control={form.control}
                          name="endingCardId"
                          render={({ field: endingCardField }) => (
                            <div className="space-y-2">
                              <FormControl>
                                <EndingCardSelector
                                  endings={survey.endings}
                                  value={endingCardField.value || ""}
                                  onChange={(value) => {
                                    form.setValue("endingCardId", value, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    form.setValue("action", "endSurvey", {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                />
                              </FormControl>
                            </div>
                          )}
                        />
                      )}
                    </div>
                  </FormItem>
                )}
              />

              {/* Count Partial Submissions Field */}
              <FormField
                control={form.control}
                name="countPartialSubmissions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        {t("environments.surveys.edit.quotas.count_partial_submissions")}
                      </FormLabel>
                      <FormDescription>
                        {t("environments.surveys.edit.quotas.count_partial_submissions_description")}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </form>
          </DialogBody>

          {/* Footer */}
          <DialogFooter className="flex justify-between">
            <div>
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    deleteQuota(quota);
                    onClose();
                  }}
                  className="flex items-center gap-2"
                  disabled={isSubmitting}>
                  <Trash2Icon className="h-4 w-4" />
                  {t("common.delete")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  disabled={isSubmitting}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || !isDirty || !isValid}
              onClick={form.handleSubmit(onSubmit)}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
