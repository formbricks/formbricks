import { TagIcon } from "lucide-react";

import { timeSinceConditionally } from "@formbricks/lib/time";
import { Badge } from "@formbricks/ui/Badge";

export default function AttributeClassDataRow({ attributeClass }) {
  return (
    <div className="m-2 grid h-16  grid-cols-5 content-center rounded-lg hover:bg-slate-100">
      <div className="col-span-5 flex items-center pl-6 text-sm sm:col-span-3">
        <div className="flex items-center">
          <div className="h-10 w-10 flex-shrink-0">
            <TagIcon className="h-8 w-8 flex-shrink-0 text-slate-500" />
          </div>
          <div className="ml-4 text-left">
            <div className="font-medium text-slate-900">
              {attributeClass.name}
              <span className="ml-2">
                {attributeClass.archived && <Badge text="Archived" type="gray" size="tiny" />}
              </span>
            </div>
            <div className="text-xs text-slate-400">{attributeClass.description}</div>
          </div>
        </div>
      </div>

      <div className="my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 md:block">
        <div className="text-slate-900">{timeSinceConditionally(attributeClass.createdAt.toString())}</div>
      </div>
      <div className="my-auto hidden whitespace-nowrap text-center text-sm text-slate-500 md:block">
        <div className="text-slate-900">{timeSinceConditionally(attributeClass.updatedAt.toString())}</div>
      </div>
    </div>
  );
}
