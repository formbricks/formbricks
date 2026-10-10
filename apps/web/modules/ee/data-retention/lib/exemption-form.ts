import { addYears, subDays } from "date-fns";
import type { TFunction } from "i18next";
import { z } from "zod";
import { getCalendarDayInTimeZone, getEndOfDayInTimeZone } from "@/lib/date-ranges";
import {
  RETENTION_EXEMPTION_MAX_YEARS,
  RETENTION_EXEMPTION_POLICIES,
  RETENTION_EXEMPTION_REASON_MAX_LENGTH,
  type TCreateRetentionExemptionInput,
} from "../types";

const ZSurveyOption = z.object({ id: z.string(), name: z.string(), workspaceName: z.string() });

/** The Add exemption form. Every field is required, and the exemption can't be open-ended (ENG-3346). */
export const getAddExemptionFormSchema = (t: TFunction) =>
  z.object({
    survey: ZSurveyOption.nullable().refine((survey) => survey !== null, {
      message: t("workspace.settings.data_retention.survey_required"),
    }),
    policy: z.enum(RETENTION_EXEMPTION_POLICIES),
    until: z
      .date()
      .nullable()
      .refine((day) => day !== null, {
        message: t("workspace.settings.data_retention.until_required"),
      }),
    reason: z
      .string()
      .trim()
      .min(1, t("workspace.settings.data_retention.reason_required"))
      .max(
        RETENTION_EXEMPTION_REASON_MAX_LENGTH,
        t("workspace.settings.data_retention.reason_too_long", { max: RETENTION_EXEMPTION_REASON_MAX_LENGTH })
      ),
  });

export type TAddExemptionFormValues = z.input<ReturnType<typeof getAddExemptionFormSchema>>;

/**
 * The days the end-date picker offers, as date-only values in the organisation's time zone: from today
 * to the last day whose end is still within ten years of now, which is the API's limit.
 */
export const getExemptionUntilBounds = (now: Date, timeZone: string): { minDay: Date; maxDay: Date } => ({
  minDay: getCalendarDayInTimeZone(now, timeZone),
  maxDay: subDays(getCalendarDayInTimeZone(addYears(now, RETENTION_EXEMPTION_MAX_YEARS), timeZone), 1),
});

/**
 * The request for a valid form. "Until Mar 31" keeps the survey through that whole day in the
 * organisation's time zone, so the exemption ends at the day's last millisecond there.
 */
export const toCreateRetentionExemptionInput = (
  values: TAddExemptionFormValues,
  timeZone: string
): TCreateRetentionExemptionInput => {
  if (!values.survey || !values.until) throw new Error("The exemption form was submitted incomplete");
  return {
    surveyId: values.survey.id,
    policy: values.policy,
    until: getEndOfDayInTimeZone(values.until, timeZone).toISOString(),
    reason: values.reason.trim(),
  };
};
