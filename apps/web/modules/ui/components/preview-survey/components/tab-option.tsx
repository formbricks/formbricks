import { ReactNode } from "react";

interface TabOptionProps {
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
  /** Accessible name — the button renders an icon only. */
  label: string;
}

export const TabOption = ({ active, icon, onClick, label }: Readonly<TabOptionProps>) => {
  return (
    <button
      type="button"
      className={`${active ? "rounded-full bg-slate-200" : ""} cursor-pointer`}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}>
      {icon}
    </button>
  );
};
