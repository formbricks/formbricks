"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { DatePicker } from "@/modules/ui/components/date-picker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Textarea } from "@/modules/ui/components/textarea";
import { useCreateRetentionExemption } from "../../hooks/use-retention-exemptions";
import { getRetentionPolicyLabel } from "../../lib/display";
import {
  type TAddExemptionFormValues,
  getAddExemptionFormSchema,
  getExemptionUntilBounds,
  toCreateRetentionExemptionInput,
} from "../../lib/exemption-form";
import { RETENTION_EXEMPTION_POLICIES, RETENTION_EXEMPTION_REASON_MAX_LENGTH } from "../../types";
import { ExemptionSurveyPicker } from "./exemption-survey-picker";

const DEFAULT_VALUES: TAddExemptionFormValues = { survey: null, policy: "surveys", until: null, reason: "" };

interface AddExemptionDialogProps {
  organizationId: string;
  /** The organisation's display time zone: the end date is a day there. */
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Exempt a survey from one policy until a date, with a reason (ENG-3346). Owners and managers only. */
export const AddExemptionDialog = ({
  organizationId,
  timeZone,
  open,
  onOpenChange,
}: Readonly<AddExemptionDialogProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const policyHelpId = useId();
  const untilErrorId = useId();
  // Taken each time the dialog opens and fixed while it is open, so a tab left open overnight doesn't
  // offer yesterday, and the range doesn't shift under the user. The parent opens it by setting `open`,
  // which Radix does not report through onOpenChange, so this follows the prop.
  const [bounds, setBounds] = useState(() => getExemptionUntilBounds(new Date(), timeZone));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBounds(getExemptionUntilBounds(new Date(), timeZone));
  }
  const createExemption = useCreateRetentionExemption();

  const form = useForm<TAddExemptionFormValues>({
    resolver: zodResolver(getAddExemptionFormSchema(t)),
    mode: "onChange",
    defaultValues: DEFAULT_VALUES,
  });

  const handleOpenChange = (next: boolean) => {
    if (createExemption.isPending) return;
    if (!next) form.reset(DEFAULT_VALUES);
    onOpenChange(next);
  };

  const onSubmit = (values: TAddExemptionFormValues) => {
    createExemption.mutate(toCreateRetentionExemptionInput(values, timeZone), {
      onSuccess: () => {
        toast.success(t("workspace.settings.data_retention.exemption_created"));
        form.reset(DEFAULT_VALUES);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(
          getV3ApiErrorMessage(error, t("workspace.settings.data_retention.exemption_create_failed"))
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>{t("workspace.settings.data_retention.add_exemption")}</DialogTitle>
              <DialogDescription>
                {t("workspace.settings.data_retention.add_exemption_description")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="survey"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.survey")}</FormLabel>
                    <FormControl>
                      <ExemptionSurveyPicker
                        organizationId={organizationId}
                        value={field.value}
                        onChange={field.onChange}
                        isInvalid={!!error}
                        disabled={createExemption.isPending}
                      />
                    </FormControl>
                    {error?.message && <FormError>{error.message}</FormError>}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="policy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.settings.data_retention.policy")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={createExemption.isPending}>
                      <FormControl>
                        <SelectTrigger aria-describedby={policyHelpId}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RETENTION_EXEMPTION_POLICIES.map((policy) => (
                          <SelectItem key={policy} value={policy}>
                            {getRetentionPolicyLabel(policy, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Not FormDescription: it renders the control's own id, which would duplicate it. */}
                    <p id={policyHelpId} className="text-xs text-slate-500">
                      {t("workspace.settings.data_retention.exemption_policy_help")}
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="until"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    {/* No htmlFor: naming the trigger "Until" would hide the date it shows. */}
                    <FormLabel htmlFor={undefined}>{t("workspace.settings.data_retention.until")}</FormLabel>
                    <div>
                      <DatePicker
                        aria-describedby={error ? untilErrorId : undefined}
                        aria-invalid={!!error}
                        value={field.value}
                        onChange={field.onChange}
                        locale={locale}
                        minDate={bounds.minDay}
                        maxDate={bounds.maxDay}
                        placeholder={t("workspace.settings.data_retention.select_end_date")}
                        disabled={createExemption.isPending}
                        triggerClassName="w-full"
                        className="w-full"
                      />
                    </div>
                    {error?.message && (
                      <p id={untilErrorId} className="text-sm text-error">
                        {error.message}
                      </p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.settings.data_retention.reason")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        maxLength={RETENTION_EXEMPTION_REASON_MAX_LENGTH}
                        isInvalid={!!error}
                        disabled={createExemption.isPending}
                        placeholder={t("workspace.settings.data_retention.reason_placeholder")}
                      />
                    </FormControl>
                    {error?.message && <FormError>{error.message}</FormError>}
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={createExemption.isPending}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={createExemption.isPending}>
                {t("workspace.settings.data_retention.exempt_survey")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
