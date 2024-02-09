import { FilterIcon, UsersIcon } from "lucide-react";

import { TSegment } from "@formbricks/types/segment";

const UserTargetingFallback = ({ segment }: { segment: TSegment | null }) => {
  const doFiltersExist = !!segment?.filters?.length;

  return (
    <div className="flex items-center gap-4">
      <div className="rounded-full border border-slate-200 bg-slate-100 p-2">
        {doFiltersExist ? (
          <UsersIcon className="h-5 w-5 text-slate-800" />
        ) : (
          <FilterIcon className="h-5 w-5 text-slate-800" />
        )}
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-medium">
          Audience: <span className="font-bold">{doFiltersExist ? "Targeted" : "Everyone"}</span>
        </h3>
        <p className="text-xs text-slate-500">
          {doFiltersExist
            ? "Only people who match your targeting can be surveyed."
            : "Without a filter, all of your users can be surveyed."}
        </p>
      </div>
    </div>
  );
};

export default UserTargetingFallback;
