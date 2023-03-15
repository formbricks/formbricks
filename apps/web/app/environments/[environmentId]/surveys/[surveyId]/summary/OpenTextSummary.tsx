/* interface OpenTextSummaryProps {
  data: any;
  type: string;
} */
import ProgressBar from "@/components/ui/ProgressBar";
import { InboxStackIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/solid";

export default function OpenTextSummary({}) {
  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <h3 className="pb-1 text-xl font-semibold text-slate-900">Wer hat an der Uhr gedreht?</h3>
        </div>
        <div className="flex space-x-2 font-semibold text-slate-600">
          <div className="rounded-lg bg-slate-100 p-2 ">Open Text Question</div>
          <div className=" flex items-center rounded-lg  bg-slate-100 p-2">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            16 responses
          </div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4" />
            2.8 average
          </div>
        </div>
      </div>
      <div className="space-y-2 rounded-b-lg bg-white px-6 pt-4 pb-6">
        <div>
          <div className="flex justify-between px-2 pb-2 text-lg">
            <div className="flex space-x-1">
              <p className="font-semibold text-slate-700">5 - Very easy</p>
              <div className="rounded-lg bg-slate-100 px-2 text-slate-700">6%</div>
            </div>
            <p className="text-slate-600">1 response</p>
          </div>
          <ProgressBar barColor="bg-brand" progress={0.3} />
        </div>
      </div>
    </div>
  );
}
