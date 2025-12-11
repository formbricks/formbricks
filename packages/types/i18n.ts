import { z } from "zod";

export const ZI18nString = z.record(z.string()).refine((obj) => "default" in obj, {
  message: "I18n string must have a 'default' key",
});

export type TI18nString = z.infer<typeof ZI18nString>;
