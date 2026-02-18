import { ReactNode } from "react";

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
}

export function DashboardWidget({ title, children }: DashboardWidgetProps) {
  return (
    <div className="flex h-full flex-col rounded-sm border border-gray-200 bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="relative min-h-[300px] flex-1 p-4">{children}</div>
    </div>
  );
}
