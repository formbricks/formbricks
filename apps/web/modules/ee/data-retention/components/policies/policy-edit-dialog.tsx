"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TFunction } from "i18next";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { SURVEY_ARCHIVE_RETENTION_DAYS } from "@/modules/survey/archive/lib/retention-days";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
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
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { useRetentionHealth } from "../../hooks/use-retention-health";
import { useUpdateRetentionPolicy } from "../../hooks/use-retention-policies";
import { formatRetentionPeriod } from "../../lib/display";
import { getRetentionPolicySaveErrorMessage } from "../../lib/error-message";
import { RETENTION_DAYS_PER_UNIT, type TRetentionPeriodUnit } from "../../lib/period";
import {
  CUSTOM,
  RETENTION_PERIOD_PRESETS,
  RETENTION_WARN_PRESETS,
  type TPolicyFormValues,
  getPolicyFormSchema,
  toPoliciesPatch,
  toPolicyFormValues,
} from "../../lib/policy-form";
import { RETENTION_WARN_DAYS } from "../../lib/policy-rules";
import {
  RETENTION_SURVEY_CONDITIONS,
  type TRetentionPolicyKind,
  type TRetentionPolicySettings,
  type TRetentionSurveyCondition,
} from "../../types";

/** The copy that differs per policy (mock, ENG-3610). */
const getPolicyCopy = (policy: TRetentionPolicyKind, t: TFunction) => {
  const notice = { min: RETENTION_WARN_DAYS.min, max: RETENTION_WARN_DAYS.max };
  const deletePeriod = formatRetentionPeriod(SURVEY_ARCHIVE_RETENTION_DAYS, t);
  switch (policy) {
    case "responses":
      return {
        title: t("workspace.settings.data_retention.responses_policy_title"),
        description: t("workspace.settings.data_retention.responses_policy_description"),
        countsFrom: t("workspace.settings.data_retention.responses_counts_from"),
        periodHelp: null,
        noticeHelp: t("workspace.settings.data_retention.responses_notice_help", notice),
        activeHelp: t("workspace.settings.data_retention.responses_active_help"),
      };
    case "surveys":
      return {
        title: t("workspace.settings.data_retention.surveys_policy_title"),
        description: t("workspace.settings.data_retention.surveys_policy_description", { deletePeriod }),
        countsFrom: null,
        periodHelp: t("workspace.settings.data_retention.surveys_period_help"),
        noticeHelp: t("workspace.settings.data_retention.surveys_notice_help", notice),
        activeHelp: t("workspace.settings.data_retention.surveys_active_help", { deletePeriod }),
      };
    case "members":
      return {
        title: t("workspace.settings.data_retention.members_policy_title"),
        description: t("workspace.settings.data_retention.members_policy_description"),
        countsFrom: t("workspace.settings.data_retention.members_counts_from"),
        periodHelp: null,
        noticeHelp: t("workspace.settings.data_retention.members_notice_help", notice),
        activeHelp: t("workspace.settings.data_retention.members_active_help"),
      };
  }
};

const getConditionLabel = (condition: TRetentionSurveyCondition, t: TFunction): string => {
  switch (condition) {
    case "noResponse":
      return t("workspace.settings.data_retention.condition_no_response");
    case "noChange":
      return t("workspace.settings.data_retention.condition_no_change");
    case "createdBefore":
      return t("workspace.settings.data_retention.condition_created_before");
  }
};

const getUnitLabel = (unit: TRetentionPeriodUnit, t: TFunction): string => {
  switch (unit) {
    case "days":
      return t("workspace.settings.data_retention.unit_days");
    case "months":
      return t("workspace.settings.data_retention.unit_months");
    case "years":
      return t("workspace.settings.data_retention.unit_years");
  }
};

/** A number input's value as a number, or null while it is empty. */
const toNumberOrNull = (value: string): number | null => (value.trim() === "" ? null : Number(value));

interface PolicyEditDialogProps {
  organizationId: string;
  policy: TRetentionPolicyKind;
  /** The saved settings; the form starts from them, since the parent mounts the dialog per edit. */
  settings: TRetentionPolicySettings;
  onClose: () => void;
}

/**
 * Edit one policy: its period (a preset, or a custom number and unit), its notice, the survey
 * conditions, and whether it is active. Owners and managers only; the server checks every rule again.
 */
export const PolicyEditDialog = ({
  organizationId,
  policy,
  settings,
  onClose,
}: Readonly<PolicyEditDialogProps>) => {
  const { t } = useTranslation();
  const copy = getPolicyCopy(policy, t);
  const noticeHelpId = useId();
  const periodHelpId = useId();
  const conditionsErrorId = useId();
  const updatePolicy = useUpdateRetentionPolicy({ organizationId });
  const health = useRetentionHealth({ organizationId });

  const form = useForm<TPolicyFormValues>({
    resolver: zodResolver(getPolicyFormSchema(t, policy)),
    mode: "onChange",
    defaultValues: toPolicyFormValues(settings),
  });
  const [periodPreset, warnPreset] = useWatch({
    control: form.control,
    name: ["periodPreset", "warnPreset"],
  });

  const handleOpenChange = (next: boolean) => {
    if (!next && !updatePolicy.isPending) onClose();
  };

  const onSubmit = (values: TPolicyFormValues) => {
    const patch = toPoliciesPatch(policy, values, settings);
    if (!patch) {
      onClose();
      return;
    }
    updatePolicy.mutate(patch, {
      onSuccess: () => {
        toast.success(t("workspace.settings.data_retention.policy_saved"));
        onClose();
      },
      onError: (error) => toast.error(getRetentionPolicySaveErrorMessage(error, t)),
    });
  };

  const disabled = updatePolicy.isPending;

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              {copy.countsFrom ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-800">
                    {t("workspace.settings.data_retention.counts_from")}
                  </p>
                  <p className="text-sm text-slate-600">{copy.countsFrom}</p>
                </div>
              ) : null}

              {policy === "surveys" ? (
                <FormField
                  control={form.control}
                  name="conditions"
                  render={({ field, fieldState: { error } }) => (
                    <fieldset className="space-y-2" aria-describedby={error ? conditionsErrorId : undefined}>
                      <legend className="text-sm font-medium text-slate-800">
                        {t("workspace.settings.data_retention.surveys_conditions_heading")}
                      </legend>
                      {RETENTION_SURVEY_CONDITIONS.map((condition) => {
                        const id = `${periodHelpId}-${condition}`;
                        const checked = field.value.includes(condition);
                        return (
                          <div key={condition} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={(next) =>
                                field.onChange(
                                  next === true
                                    ? [...field.value, condition]
                                    : field.value.filter((value) => value !== condition)
                                )
                              }
                            />
                            <Label htmlFor={id} className="font-normal">
                              {getConditionLabel(condition, t)}
                            </Label>
                          </div>
                        );
                      })}
                      {error?.message ? (
                        <p id={conditionsErrorId} role="alert" className="text-sm text-error">
                          {error.message}
                        </p>
                      ) : null}
                    </fieldset>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="periodPreset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.settings.data_retention.period")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                      <FormControl>
                        <SelectTrigger aria-describedby={copy.periodHelp ? periodHelpId : undefined}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RETENTION_PERIOD_PRESETS.map((days) => (
                          <SelectItem key={days} value={String(days)}>
                            {formatRetentionPeriod(days, t)}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM}>
                          {t("workspace.settings.data_retention.custom")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {copy.periodHelp ? (
                      <p id={periodHelpId} className="text-xs text-slate-500">
                        {copy.periodHelp}
                      </p>
                    ) : null}
                  </FormItem>
                )}
              />

              {periodPreset === CUSTOM ? (
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="customPeriodAmount"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t("workspace.settings.data_retention.custom_period_amount")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(toNumberOrNull(event.target.value))}
                            onBlur={field.onBlur}
                            isInvalid={!!error}
                            disabled={disabled}
                          />
                        </FormControl>
                        {error?.message ? <FormError>{error.message}</FormError> : null}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customPeriodUnit"
                    render={({ field }) => (
                      <FormItem className="w-36">
                        <FormLabel>{t("workspace.settings.data_retention.custom_period_unit")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(unit) => {
                            field.onChange(unit);
                            // The range depends on the unit, so recheck the amount against it.
                            void form.trigger("customPeriodAmount");
                          }}
                          disabled={disabled}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(Object.keys(RETENTION_DAYS_PER_UNIT) as TRetentionPeriodUnit[]).map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {getUnitLabel(unit, t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <FormField
                control={form.control}
                name="warnPreset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.settings.data_retention.notice")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                      <FormControl>
                        <SelectTrigger aria-describedby={noticeHelpId}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RETENTION_WARN_PRESETS.map((days) => (
                          <SelectItem key={days} value={String(days)}>
                            {formatRetentionPeriod(days, t)}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM}>
                          {t("workspace.settings.data_retention.customise")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p id={noticeHelpId} className="text-xs text-slate-500">
                      {copy.noticeHelp}
                    </p>
                  </FormItem>
                )}
              />

              {warnPreset === CUSTOM ? (
                <FormField
                  control={form.control}
                  name="customWarnDays"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem>
                      <FormLabel>{t("workspace.settings.data_retention.custom_notice_days")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={RETENTION_WARN_DAYS.min}
                          max={RETENTION_WARN_DAYS.max}
                          step={1}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(toNumberOrNull(event.target.value))}
                          onBlur={field.onBlur}
                          isInvalid={!!error}
                          disabled={disabled}
                        />
                      </FormControl>
                      {error?.message ? <FormError>{error.message}</FormError> : null}
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-4">
                      <FormLabel>{t("workspace.settings.data_retention.policy_is_active")}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                      </FormControl>
                    </div>
                    <p className="text-xs text-slate-500">{copy.activeHelp}</p>
                    {field.value && health.data?.smtpConfigured === false ? (
                      <Alert variant="warning" size="small" role="status">
                        <AlertDescription>
                          {t("workspace.settings.data_retention.smtp_not_configured_warning")}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </FormItem>
                )}
              />

              <p className="text-xs text-slate-500">
                {t("workspace.settings.data_retention.first_night_note")}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={disabled}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={disabled}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
