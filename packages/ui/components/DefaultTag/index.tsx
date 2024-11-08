import { useTranslations } from "next-intl";

export const DefaultTag = () => {
  const t = useTranslations();
  return (
    <div className="flex h-6 items-center justify-center rounded-xl bg-slate-200 px-3">
      <p className="text-xs">{t("common.default")}</p>
    </div>
  );
};
