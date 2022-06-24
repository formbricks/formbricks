import React from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/outline";
import { classNames } from "../../lib/utils";

interface Props {
  children: React.ReactNode;
  KPI: string;
  typeText?: boolean;
  label: string;
  toolTipText: string;
  trend: number;
}

const AnalyticsCard: React.FC<Props> = ({
  children,
  KPI,
  typeText = false,
  label,
  toolTipText,
  trend,
}) => {
  return (
    <div className="grid content-between px-4 py-2 bg-white rounded-md shadow-md">
      <div className="inline-flex items-center text-sm text-ui-gray-dark">
        {label}{" "}
        {toolTipText && (
          <QuestionMarkCircleIcon className="w-4 h-4 ml-1 text-red hover:text-ui-gray-dark" />
        )}
      </div>
      <div
        className={classNames(
          `font-bold leading-none flex justify-between items-end`,
          typeText ? "text-3xl tracking-tight leading-10" : "text-7xl"
        )}
      >
        {KPI}
        {trend && (
          <div className="flex items-center h-6 px-6 py-2 mb-2.5 text-sm font-light text-green-600 bg-green-200 rounded-full">
            {trend} %
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsCard;
