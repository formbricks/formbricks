import { Card, Text, Metric } from "@tremor/react";
import { Toggle, ToggleItem } from "@tremor/react";
import { ChartPieIcon, ChartBarIcon } from "@heroicons/react/24/outline";

interface OpenTextSummaryBodyProps {
  data: any;
}

export default function OpenTextSummary({ data }: OpenTextSummaryBodyProps) {
  return (
    <div className="space-y-2 rounded-lg border-2 border-slate-200 p-4">
      {data.answers.map((answer, idx) => (
        <div key={idx}>{answer}</div>
      ))}
    </div>
  );
}
