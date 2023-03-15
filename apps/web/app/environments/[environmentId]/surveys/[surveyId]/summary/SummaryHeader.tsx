import { Card, Text, Metric } from "@tremor/react";
import { Toggle, ToggleItem } from "@tremor/react";
import { ChartPieIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import OpenTextSummaryBody from "./OpenTextSummaryBody";

interface SummaryHeaderProps {
  data: any;
  type: string;
}

export default function SummaryHeader({ data, type }: SummaryHeaderProps) {
  return (
    <div className="space-y-2 rounded-lg border-2 border-slate-200 p-4">
      <div>
        <h3 className="inline-block text-xl font-semibold text-slate-900">{data.question}</h3>
      </div>
      <div className="inline-block">
        {/*         <Toggle color="zinc" /* defaultValue="1"   onValueChange={(value) => console.log(value)} >
          <ToggleItem value="1" icon={ChartPieIcon} />
          <ToggleItem value="2" icon={ChartBarIcon} />
        </Toggle> */}
      </div>
      <div>
        <div className="inline-block rounded-lg bg-slate-100 p-2 font-semibold text-slate-700">Open Text</div>
        <div className="inline-block px-2 text-slate-500">16 responses, 2.8 average</div>
      </div>
      <div>{type === "openText" && <OpenTextSummaryBody data={data} />}</div>
    </div>
  );
}
