import { FormatIcu } from "@tolgee/format-icu";
import { DevTools, Tolgee } from "@tolgee/web";

const apiKey = process.env.NEXT_PUBLIC_TOLGEE_API_KEY;
const apiUrl = process.env.NEXT_PUBLIC_TOLGEE_API_URL;

export const ALL_LANGUAGES = ["en-US", "de-DE", "fr-FR", "pt-BR", "pt-PT", "zh-Hant-TW"];

export const DEFAULT_LANGUAGE = "en-US";

export function TolgeeBase() {
  return Tolgee()
    .use(FormatIcu())
    .use(DevTools())
    .updateDefaults({
      apiKey,
      apiUrl,
      staticData: {
        "en-US": () => import("@/locales/en-US.json"),
        "de-DE": () => import("@/locales/de-DE.json"),
        "fr-FR": () => import("@/locales/fr-FR.json"),
        "pt-BR": () => import("@/locales/pt-BR.json"),
        "pt-PT": () => import("@/locales/pt-PT.json"),
        "zh-Hant-TW": () => import("@/locales/zh-Hant-TW.json"),
      },
    });
}
