import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { type TUsageMeter, USAGE_METER_BAR_CLASS } from "../lib/usage-meter";

interface UsageMeterRowProps {
  label: string;
  meter: TUsageMeter;
  /** Right-hand text, already translated and formatted ("4,210 of 10,000 this month"). */
  value: string;
}

/** One usage line: label and value above a bar. Without a limit there is no bar to fill, so none is drawn. */
export const UsageMeterRow = ({ label, meter, value }: Readonly<UsageMeterRowProps>) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <span className="font-medium text-slate-800">{label}</span>
      <span className="text-slate-500">{value}</span>
    </div>
    {meter.limit !== null && (
      <ProgressBar progress={meter.ratio} barColor={USAGE_METER_BAR_CLASS[meter.tone]} height={5} />
    )}
  </div>
);
