import { getTranslate } from "@/tolgee/server";

export const WebhookTableHeading = async () => {
  const t = await getTranslate();
  return (
    <>
      <div className="grid h-12 grid-cols-12 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
        <span className="sr-only">{t("common.edit")}</span>
        <div className="col-span-3 pl-6">{t("common.webhook")}</div>
        <div className="col-span-1 text-center">{t("environments.integrations.webhooks.source")}</div>
        <div className="col-span-4 text-center">{t("common.surveys")}</div>
        <div className="col-span-2 text-center">{t("environments.integrations.webhooks.triggers")}</div>
        <div className="col-span-2 text-center">{t("common.updated")}</div>
      </div>
    </>
  );
};
