interface SettingsIdProps {
  title: string;
  id: string;
}

export const SettingsId = ({ title, id }: SettingsIdProps) => {
  return (
    <p className="py-1 text-xs text-slate-400">
      {title}: {id}
    </p>
  );
};
