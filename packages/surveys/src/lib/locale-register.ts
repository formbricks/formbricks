import { type TSurveyRuntimeLanguageCode } from "@formbricks/i18n-utils/survey-runtime-languages";

// Respondent-facing strings address the respondent formally in languages that distinguish a formal from
// an informal "you" (ENG-2515). English has no such distinction, so a machine translation of the
// English source picks a register per string and drifts between the two — "Wähle eine Option" next to
// "Bitte wählen Sie ein Datum" (ENG-2790). The patterns below name each bundle's informal forms so a
// test can reject a bundle that slipped back; register-neutral phrasing ("Option wählen") passes.
const informalForms = (alternatives: string): RegExp =>
  new RegExp(String.raw`(?<![\p{L}\p{M}])(?:${alternatives})(?![\p{L}\p{M}])`, "iu");

export const INFORMAL_ADDRESS_PATTERNS: Partial<Record<TSurveyRuntimeLanguageCode, RegExp>> = {
  "de-DE": informalForms(
    [
      // pronouns
      "du|dich|dir|dein|deine[nmrs]?|euch|euer|eure[nmrs]?",
      // imperatives used in survey UI copy
      "wähle|klicke|ziehe|gib|versuche|benenne|kontaktiere|fülle|antworte",
      // second-person singular verb forms
      "bist|hast|kannst|antwortest|möchtest|willst",
    ].join("|")
  ),
  "ru-RU": informalForms(
    [
      // pronouns
      "ты|тебя|тебе|тобой|твой|твою|твоя|твоё|твое|твоей|твоём|твоем|твоему|твоего|твои|твоим|твоими|твоих",
      // imperatives used in survey UI copy
      "выбери|попробуй|нажми|введи|перетащи|переименуй|свяжись|заполни|ответь",
      // second-person singular verb forms
      "можешь|будешь|дышишь|ответишь",
    ].join("|")
  ),
};

export interface TInformalAddressHit {
  key: string;
  value: string;
  match: string;
}

/** Walks a translation bundle and returns every string that contains an informal form. */
export const findInformalAddress = (bundle: unknown, pattern: RegExp): TInformalAddressHit[] => {
  const hits: TInformalAddressHit[] = [];
  const walk = (node: unknown, path: string[]): void => {
    if (typeof node === "string") {
      const match = pattern.exec(node);
      if (match) hits.push({ key: path.join("."), value: node, match: match[0] });
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) walk(child, [...path, key]);
    }
  };
  walk(bundle, []);
  return hits;
};
