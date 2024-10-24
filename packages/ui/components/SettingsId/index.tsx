import { useTranslations } from "next-intl";

interface SettingsIdProps {
  title: string;
  id: string;
}

export const SettingsId = ({ title, id }: SettingsIdProps) => {
  const t = useTranslations();
  return (
    <p className="py-1 text-xs text-slate-400">
      {t(title)}: {id}
    </p>
  );
};
