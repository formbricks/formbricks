import { ReactNode } from "react";

export default function TabOption({
  active,
  icon,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className={`${active ? "rounded-full bg-slate-200" : ""} cursor-pointer`} onClick={onClick}>
      {icon}
    </div>
  );
}
