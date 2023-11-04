import { z } from "zod";

const LanguageCode = z.string().min(2).max(2);

export const ZI18nObject = z
  .object({
    _i18n_: z.literal(true),
  })
  .and(z.record(LanguageCode, z.string()));

export type I18nString = z.infer<typeof ZI18nObject>;
