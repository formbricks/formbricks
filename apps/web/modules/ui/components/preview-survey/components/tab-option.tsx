import { ReactNode } from "react";

interface TabOptionProps {
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}

export const TabOption = ({ active, icon, onClick }: TabOptionProps) => {
  return (
    <button className={`${active ? "rounded-full bg-slate-200" : ""} cursor-pointer`} onClick={onClick}>
      {icon}
    </button>
  );
};
