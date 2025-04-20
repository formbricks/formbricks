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
        "en-US": () => import("@/lib/messages/en-US.json"),
        "de-DE": () => import("@/lib/messages/de-DE.json"),
        "fr-FR": () => import("@/lib/messages/fr-FR.json"),
        "pt-BR": () => import("@/lib/messages/pt-BR.json"),
        "pt-PT": () => import("@/lib/messages/pt-PT.json"),
        "zh-Hant-TW": () => import("@/lib/messages/zh-Hant-TW.json"),
      },
    });
}
