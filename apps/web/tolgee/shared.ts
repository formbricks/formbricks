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
        "en-US": () => import("@formbricks/lib/messages/en-US.json"),
        "de-DE": () => import("@formbricks/lib/messages/de-DE.json"),
        "fr-FR": () => import("@formbricks/lib/messages/fr-FR.json"),
        "pt-BR": () => import("@formbricks/lib/messages/pt-BR.json"),
        "pt-PT": () => import("@formbricks/lib/messages/pt-PT.json"),
        "zh-Hant-TW": () => import("@formbricks/lib/messages/zh-Hant-TW.json"),
      },
    });
}
