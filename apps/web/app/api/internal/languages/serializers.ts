import type { TLanguage } from "@formbricks/types/workspace";

/**
 * A workspace language as the API answers with it, with ISO timestamps. The workspace is the one the
 * caller wrote to, so it is not repeated.
 */
export type TLanguageResource = {
  id: string;
  code: string;
  alias: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A survey that uses a language, as the "can't remove this language" warning names it. */
export type TLanguageSurveyResource = { name: string };

export const serializeLanguage = (language: TLanguage): TLanguageResource => ({
  id: language.id,
  code: language.code,
  alias: language.alias,
  createdAt: language.createdAt.toISOString(),
  updatedAt: language.updatedAt.toISOString(),
});

export const serializeLanguageSurvey = (name: string): TLanguageSurveyResource => ({ name });
