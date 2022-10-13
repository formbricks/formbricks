import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";
import React from "react";
import { classNames } from "../../lib/utils";

interface Props {
  value: string | number;
  label: string;
  toolTipText: string;
  trend?: number;
  smallerText?: boolean;
}

const AnalyticsCard: React.FC<Props> = ({ value, label, toolTipText, trend, smallerText }) => {
  return (
    <div className="rounded-md bg-white shadow-md">
      <div key={label} className="px-4 py-5 sm:p-6">
        <dt className="has-tooltip inline-flex text-base font-normal text-gray-900">
          {label}{" "}
          {toolTipText && (
            <QuestionMarkCircleIcon className="text-red hover:text-ui-gray-dark ml-1 h-4 w-4" />
          )}
          {toolTipText && (
            <span className="tooltip -mt-6 -ml-8 flex grow rounded bg-gray-600 p-1 px-4 text-center text-xs text-white shadow-lg">
              {toolTipText}
            </span>
          )}
        </dt>
        <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
          <div
            className={classNames(
              smallerText ? "text-lg" : "text-xl",
              "flex items-baseline text-xl font-semibold text-gray-800"
            )}>
            {value}
          </div>

          {trend && (
            <div
              className={classNames(
                trend >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
                "inline-flex items-baseline rounded-full px-2.5 py-0.5 text-sm font-medium md:mt-2 lg:mt-0"
              )}>
              {trend >= 0 ? (
                <ArrowUpIcon
                  className="-ml-1 mr-0.5 h-5 w-5 flex-shrink-0 self-center text-green-500"
                  aria-hidden="true"
                />
              ) : (
                <ArrowDownIcon
                  className="-ml-1 mr-0.5 h-5 w-5 flex-shrink-0 self-center text-red-500"
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">{trend >= 0 ? "Increased" : "Decreased"} by</span>
              {trend} %
            </div>
          )}
        </dd>
      </div>
    </div>
  );
};

export default AnalyticsCard;
