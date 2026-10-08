import type { TFunction } from "i18next";
import { z } from "zod";
import {
  RETENTION_SURVEY_CONDITIONS,
  type TRetentionPoliciesPatch,
  type TRetentionPolicyKind,
  type TRetentionPolicySettings,
  type TRetentionSurveyCondition,
} from "../types";
import { formatRetentionPeriod } from "./display";
import { RETENTION_DAYS_PER_UNIT, daysToRetentionPeriod, retentionPeriodToDays } from "./period";
import { RETENTION_PERIOD_DAYS, RETENTION_WARN_DAYS, getRetentionPeriodField } from "./policy-rules";

/** The period presets the edit dialog offers (ENG-3610), in days; anything else is "Custom". */
export const RETENTION_PERIOD_PRESETS = [30, 90, 365, 1095, 1825] as const;
/** The notice presets; anything else is behind "Customise". */
export const RETENTION_WARN_PRESETS = [30, 60, 90] as const;
export const CUSTOM = "custom";

const ZUnit = z.enum(Object.keys(RETENTION_DAYS_PER_UNIT) as [keyof typeof RETENTION_DAYS_PER_UNIT]);

/**
 * The policy edit dialog. A preset is the number of days as a string, or "custom". The custom inputs are
 * kept even while a preset is chosen, so switching back to "Custom" shows what was typed.
 */
export const getPolicyFormSchema = (t: TFunction, policy: TRetentionPolicyKind) =>
  z
    .object({
      enabled: z.boolean(),
      periodPreset: z.string(),
      customPeriodAmount: z.number().nullable(),
      customPeriodUnit: ZUnit,
      warnPreset: z.string(),
      customWarnDays: z.number().nullable(),
      conditions: z.array(z.enum(RETENTION_SURVEY_CONDITIONS)),
    })
    .superRefine((values, ctx) => {
      const periodDays = getPolicyFormPeriodDays(values);
      if (
        periodDays === null ||
        periodDays < RETENTION_PERIOD_DAYS.min ||
        periodDays > RETENTION_PERIOD_DAYS.max
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["customPeriodAmount"],
          message: t("workspace.settings.data_retention.period_out_of_range", {
            min: formatRetentionPeriod(RETENTION_PERIOD_DAYS.min, t),
            max: formatRetentionPeriod(RETENTION_PERIOD_DAYS.max, t),
          }),
        });
      }
      const warnDays = getPolicyFormWarnDays(values);
      if (warnDays === null || warnDays < RETENTION_WARN_DAYS.min || warnDays > RETENTION_WARN_DAYS.max) {
        ctx.addIssue({
          code: "custom",
          path: ["customWarnDays"],
          message: t("workspace.settings.data_retention.notice_out_of_range", {
            min: RETENTION_WARN_DAYS.min,
            max: RETENTION_WARN_DAYS.max,
          }),
        });
      }
      if (policy === "surveys" && values.conditions.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["conditions"],
          message: t("workspace.settings.data_retention.conditions_required"),
        });
      }
    });

export type TPolicyFormValues = z.infer<ReturnType<typeof getPolicyFormSchema>>;

/** The period in days, or null when the custom amount isn't a positive whole number. */
export const getPolicyFormPeriodDays = (
  values: Pick<TPolicyFormValues, "periodPreset" | "customPeriodAmount" | "customPeriodUnit">
): number | null => {
  if (values.periodPreset !== CUSTOM) return Number(values.periodPreset);
  const amount = values.customPeriodAmount;
  if (amount === null || !Number.isSafeInteger(amount) || amount <= 0) return null;
  return retentionPeriodToDays({ amount, unit: values.customPeriodUnit });
};

/** The notice in days, or null when the custom value isn't a whole number. */
export const getPolicyFormWarnDays = (
  values: Pick<TPolicyFormValues, "warnPreset" | "customWarnDays">
): number | null => {
  if (values.warnPreset !== CUSTOM) return Number(values.warnPreset);
  const days = values.customWarnDays;
  return days !== null && Number.isSafeInteger(days) ? days : null;
};

/** The dialog's starting values for a policy's settings, picking the preset that matches when one does. */
export const toPolicyFormValues = (
  policy: TRetentionPolicyKind,
  settings: TRetentionPolicySettings
): TPolicyFormValues => {
  const periodDays = settings[getRetentionPeriodField(policy)] ?? RETENTION_PERIOD_PRESETS[0];
  const isPeriodPreset = (RETENTION_PERIOD_PRESETS as readonly number[]).includes(periodDays);
  const customPeriod = daysToRetentionPeriod(periodDays);
  const isWarnPreset = (RETENTION_WARN_PRESETS as readonly number[]).includes(settings.warnDays);

  return {
    enabled: settings.enabled,
    periodPreset: isPeriodPreset ? String(periodDays) : CUSTOM,
    customPeriodAmount: customPeriod.amount,
    customPeriodUnit: customPeriod.unit,
    warnPreset: isWarnPreset ? String(settings.warnDays) : CUSTOM,
    customWarnDays: settings.warnDays,
    conditions: [...settings.conditions],
  };
};

/**
 * The `PATCH` body for a valid form: only the fields the dialog edits for that policy. The steps it
 * doesn't show (the survey delete step, the absent ones) are left to the server.
 */
export const toPolicyPatch = (
  policy: TRetentionPolicyKind,
  values: TPolicyFormValues
): Partial<TRetentionPolicySettings> => {
  const periodDays = getPolicyFormPeriodDays(values);
  const warnDays = getPolicyFormWarnDays(values);
  if (periodDays === null || warnDays === null) throw new Error("The policy form was submitted invalid");

  return {
    enabled: values.enabled,
    warnDays,
    [getRetentionPeriodField(policy)]: periodDays,
    ...(policy === "surveys" ? { conditions: orderConditions(values.conditions) } : {}),
  };
};

/** Conditions in their canonical order, so the stored set doesn't depend on the order they were ticked. */
export const orderConditions = (
  conditions: readonly TRetentionSurveyCondition[]
): TRetentionSurveyCondition[] =>
  RETENTION_SURVEY_CONDITIONS.filter((condition) => conditions.includes(condition));

/**
 * The `PATCH` request for a valid form: only the fields that differ from the settings the dialog
 * opened with, so saving one change can't undo a concurrent one to another field (say, someone else
 * pausing the policy meanwhile). Null when nothing changed.
 */
export const toPoliciesPatch = (
  policy: TRetentionPolicyKind,
  values: TPolicyFormValues,
  saved: TRetentionPolicySettings
): TRetentionPoliciesPatch | null => {
  const edited = toPolicyPatch(policy, values);
  const changed = Object.fromEntries(
    Object.entries(edited).filter(([field, value]) => {
      const before = saved[field as keyof TRetentionPolicySettings];
      return Array.isArray(value) && Array.isArray(before)
        ? orderConditions(before).join() !== value.join()
        : before !== value;
    })
  ) as Partial<TRetentionPolicySettings>;
  if (Object.keys(changed).length === 0) return null;

  const { conditions, ...fields } = changed;
  switch (policy) {
    case "responses":
      return { responses: fields };
    case "surveys":
      return { surveys: conditions ? { ...fields, conditions } : fields };
    case "members":
      return { members: fields };
  }
};
