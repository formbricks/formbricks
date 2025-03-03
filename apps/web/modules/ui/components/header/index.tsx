import React from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="space-y-8 text-center">
      <p className="text-4xl font-medium text-slate-800">{title}</p>
      {subtitle && <p className="text-slate-500">{subtitle}</p>}
    </div>
  );
};
