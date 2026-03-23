import type { TUserLocale } from "@formbricks/types/user";
import { getTranslate } from "@/lingodotdev/server";

interface NoScriptWarningProps {
  locale: TUserLocale;
}

export const NoScriptWarning = async ({ locale }: NoScriptWarningProps) => {
  const t = await getTranslate(locale);

  return (
    <noscript>
      <div className="fixed inset-0 z-[9999] flex h-dvh w-full items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-slate-800">{t("common.javascript_required")}</h1>
          <p className="text-slate-600">{t("common.javascript_required_description")}</p>
        </div>
      </div>
    </noscript>
  );
};
