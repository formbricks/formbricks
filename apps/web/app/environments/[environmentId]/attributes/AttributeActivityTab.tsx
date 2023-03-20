import { Label } from "@/components/ui/Label";
import { convertDateTimeStringShort } from "@/lib/time";
import type { AttributeClass } from "@prisma/client";

interface EventActivityTabProps {
  attributeClass: AttributeClass;
}

export default function EventActivityTab({ attributeClass }: EventActivityTabProps) {
  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">Active surveys</Label>
          <p className="text-sm text-slate-900">-</p>
        </div>
        <div>
          <Label className="text-slate-500">Inactive surveys</Label>
          <p className="text-sm text-slate-900">-</p>
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">Created on</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(attributeClass.createdAt.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className=" text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(attributeClass.updatedAt.toString())}
          </p>
        </div>
      </div>
    </div>
  );
}
