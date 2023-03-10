import { Label } from "@/components/ui/Label";
import { convertDateTimeStringShort } from "@/lib/time";
import { capitalizeFirstLetter } from "@/lib/utils";

interface ActivityTabProps {
  eventClass: {
    createdAt: string;
    updatedAt: string;
    type: string;
  };
}

export default function ActivityTab({ eventClass }: ActivityTabProps) {
  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">Ocurrances</Label>
          <div className="mt-1 grid w-fit grid-cols-3 rounded-lg border-slate-100 bg-slate-50">
            <div className="border-r border-slate-200 py-2 px-4 text-center">
              <p className="font-bold text-slate-800">1</p>
              <p className="text-xs text-slate-500">last hour</p>
            </div>
            <div className="border-r border-slate-200 py-2 px-4 text-center">
              <p className="font-bold text-slate-800">1</p>
              <p className="text-xs text-slate-500">last hour</p>
            </div>
            <div className="py-2 px-4 text-center">
              <p className="font-bold text-slate-800">1</p>
              <p className="text-xs text-slate-500">last hour</p>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-slate-500">Active surveys</Label>
          <p className="text-slate-900">List of active surveys</p>
        </div>
        <div>
          <Label className="text-slate-500">Inactive surveys</Label>
          <p className="text-slate-900">List of inactive surveys</p>
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">Created on</Label>
          <p className=" text-sm text-slate-700">{convertDateTimeStringShort(eventClass.createdAt)}</p>
        </div>{" "}
        <div>
          <Label className=" text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-sm text-slate-700">{convertDateTimeStringShort(eventClass.updatedAt)}</p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">Type</Label>
          <p className="text-sm text-slate-700">{capitalizeFirstLetter(eventClass.type)}</p>
        </div>
      </div>
    </div>
  );
}
