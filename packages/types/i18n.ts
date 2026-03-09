import { z } from "zod";

export const ZI18nString = z.record(z.string(), z.string()).refine((obj) => "default" in obj, {
  error: "I18n string must have a 'default' key",
});

export type TI18nString = z.infer<typeof ZI18nString>;
