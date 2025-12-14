import { CalendarIcon } from "lucide-react";
import { TTimeUnit } from "@formbricks/types/segment";
import { DatePicker } from "@/modules/ui/components/date-picker";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface DateFilterValueProps {
  filterId: string;
  operator: string;
  value: string | number | { amount: number; unit: TTimeUnit } | [string, string];
  onChange: (value: string | number | { amount: number; unit: TTimeUnit } | [string, string]) => void;
}

export const DateFilterValue = ({ operator, value, onChange }: DateFilterValueProps) => {
  // Handle relative operators (isOlderThan, isNewerThan)
  if (operator === "isOlderThan" || operator === "isNewerThan") {
    const relativeValue =
      typeof value === "object" && !Array.isArray(value)
        ? (value as { amount: number; unit: TTimeUnit })
        : { amount: 1, unit: "days" as TTimeUnit };

    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={relativeValue.amount}
          onChange={(e) =>
            onChange({
              ...relativeValue,
              amount: parseInt(e.target.value) || 0,
            })
          }
          className="w-20 bg-white"
        />
        <Select
          value={relativeValue.unit}
          onValueChange={(unit) =>
            onChange({
              ...relativeValue,
              unit: unit as TTimeUnit,
            })
          }>
          <SelectTrigger className="w-32 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">days</SelectItem>
            <SelectItem value="weeks">weeks</SelectItem>
            <SelectItem value="months">months</SelectItem>
            <SelectItem value="years">years</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Handle isBetween (Range)
  if (operator === "isBetween") {
    const rangeValue = Array.isArray(value) ? (value as [string, string]) : ["", ""];
    const [startDate, endDate] = rangeValue;

    return (
      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <DatePicker
            date={startDate ? new Date(startDate) : null}
            updateSurveyDate={(date) => {
              if (date) {
                onChange([date.toISOString(), endDate]);
              }
            }}
          />
          <CalendarIcon className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
        </div>
        <span className="text-sm text-slate-500">and</span>
        <div className="relative w-full">
          <DatePicker
            date={endDate ? new Date(endDate) : null}
            updateSurveyDate={(date) => {
              if (date) {
                onChange([startDate, date.toISOString()]);
              }
            }}
          />
          <CalendarIcon className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
        </div>
      </div>
    );
  }

  // Handle absolute operators (isBefore, isAfter, isSameDay)
  return (
    <div className="relative w-full">
      <DatePicker
        date={typeof value === "string" && value ? new Date(value) : null}
        updateSurveyDate={(date) => {
          if (date) {
            onChange(date.toISOString());
          }
        }}
      />
      <CalendarIcon className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
    </div>
  );
};
