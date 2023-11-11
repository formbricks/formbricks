import { z } from "zod";

const LanguageCode = z.string().min(2).max(2);

export const ZI18nObject = z
  .object({
    _i18n_: z.boolean(),
    en: z.string(),
  })
  .and(z.record(LanguageCode, z.string()).optional());

export type TI18nString = z.infer<typeof ZI18nObject>;
