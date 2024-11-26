import { CrownIcon } from "lucide-react";

export const ProBadge = () => {
  return (
    <div className="ml-2 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-slate-500">
      <CrownIcon className="h-3 w-3" />
      <span className="ml-1 text-xs">PRO</span>
    </div>
  );
};
