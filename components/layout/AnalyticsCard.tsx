import React from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/outline";
import { classNames } from "../../lib/utils";

interface Props {
  children: React.ReactNode;
  KPI: string;
  typeText?: boolean;
  label: string;
  hasToolTip?: boolean;
  toolTipText: string;
  hasTrend?: boolean;
  trend: number;
}

const AnalyticsCard: React.FC<Props> = ({
  children,
  KPI,
  typeText = false,
  label,
  hasToolTip = false,
  toolTipText,
  hasTrend = false,
  trend,
}) => {
  return (
    <div className="relative px-4 pt-5 overflow-hidden bg-white rounded-lg shadow sm:pt-6 sm:px-6s">
      <div className="inline-flex items-center justify-center text-ui-gray-dark">
        {label}{" "}
        {hasToolTip && (
          <QuestionMarkCircleIcon className="w-4 h-4 ml-1 text-red hover:text-ui-gray-dark" />
        )}
      </div>
      <div
        className={classNames(
          `justify-between font-bold leading-none `,
          typeText ? "text-2xl" : "",
          "text-8xl"
        )}
      >
        {KPI}
        {hasTrend && (
          <div className="text-green-600 bg-green-200 rounded-full">
            {trend}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsCard;
