import { DevTools, FormatSimple, Tolgee } from "@tolgee/web";

const apiKey = process.env.NEXT_PUBLIC_TOLGEE_API_KEY;
const apiUrl = process.env.NEXT_PUBLIC_TOLGEE_API_URL;

export const ALL_LANGUAGES = ["en-US", "de-DE", "es-ES", "pt-BR"];

export const DEFAULT_LANGUAGE = "en-US";

export function TolgeeBase() {
  return (
    Tolgee()
      .use(FormatSimple())
      // replace with .use(FormatIcu()) for rendering plurals, foramatted numbers, etc.
      .use(DevTools())
      .updateDefaults({
        apiKey,
        apiUrl,
        staticData: {
          "en-US": () => import("@formbricks/lib/messages/en-US.json"),
          "de-DE": () => import("@formbricks/lib/messages/de-DE.json"),
          "fr-FR": () => import("@formbricks/lib/messages/fr-FR.json"),
          "pt-BR": () => import("@formbricks/lib/messages/pt-BR.json"),
        },
      })
  );
}
