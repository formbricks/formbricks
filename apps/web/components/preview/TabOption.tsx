import { ReactNode } from "react";

export default function OptionButton ({ active, icon, onClick }:
  {active:boolean, icon:ReactNode, onClick:()=>void}) {
    return (
      <div
        className={`${
          active ? "bg-slate-200 rounded-full" : ""
        } cursor-pointer`}
        onClick={onClick}
      >
        {icon}
      </div>
    );
  };
  