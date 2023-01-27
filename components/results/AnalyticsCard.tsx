import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/solid";
import React, { useState } from "react";
import { classNames } from "../../lib/utils";

interface Props {
  value: string | number;
  label: string;
  toolTipText: string;
  trend?: number;
  smallerText?: boolean;
  questions: [];
}

interface QuestionItemProps {
  value: string | number;
  label: string;
  toolTipText: string;
  trend?: number;
  smallerText?: boolean;
  options: [];
  candidate: [];
}

const AnalyticsCard: React.FC<Props> = ({
  value,
  label,
  toolTipText,
  trend,
  smallerText,
  questions,
}) => {
  const [isItemOpened, setIsItemOpened] = useState(false);
  return (
    <div
      onClick={() => {
        if (questions?.length) {
          setIsItemOpened(!isItemOpened);
        }
      }}
      className={`bg-white  rounded-md shadow-md flex justify-center flex-wrap transition-opacity duration-200 ${
        isItemOpened && questions.length ? "pb-5" : "pb-5"
      } ${questions?.length ? "cursor-pointer" : ""}`}
    >
      <div key={label} className='px-4 py-5 sm:p-6 w-full'>
        <dt className='inline-flex w-full justify-between text-xl font-semibold text-gray-900 has-tooltip'>
          {label}{" "}
          {toolTipText && (
            <QuestionMarkCircleIcon className='w-4 h-4 ml-1 text-red hover:text-ui-gray-dark' />
          )}
          {toolTipText && (
            <span className='flex p-1 px-4 -mt-6 -ml-8 text-xs text-center text-white bg-gray-600 rounded shadow-lg grow tooltip'>
              {toolTipText}
            </span>
          )}
          {!questions?.length ? null : !isItemOpened ? (
            <ChevronDownIcon
              className='-ml-1 mr-0.5 flex-shrink-0 self-center h-5 w-5 '
              aria-hidden='true'
            />
          ) : (
            <ChevronUpIcon
              className='-ml-1 mr-0.5 flex-shrink-0 self-center h-5 w-5 '
              aria-hidden='true'
            />
          )}
        </dt>
        <dd className='flex items-baseline justify-between mt-1 md:block lg:flex'>
          <div
            className={classNames(
              smallerText ? "text-lg" : "text-lg",
              "flex items-baseline text-md font-semibold text-gray-300 mt-3"
            )}
          >
            {value}
          </div>

          {trend && (
            <div
              className={classNames(
                trend >= 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800",
                "inline-flex items-baseline px-2.5 py-0.5 rounded-full text-sm font-medium md:mt-2 lg:mt-0"
              )}
            >
              {trend >= 0 ? (
                <ArrowUpIcon
                  className='-ml-1 mr-0.5 flex-shrink-0 self-center h-5 w-5 text-green-500'
                  aria-hidden='true'
                />
              ) : (
                <ArrowDownIcon
                  className='-ml-1 mr-0.5 flex-shrink-0 self-center h-5 w-5 text-red-500'
                  aria-hidden='true'
                />
              )}
              <span className='sr-only'>
                {trend >= 0 ? "Increased" : "Decreased"} by
              </span>
              {trend} %
            </div>
          )}
        </dd>
      </div>
      {!questions?.length || !isItemOpened ? null : (
        <>
          <div
            className={"flex items-baseline text-lg font-normal text-gray-800 w-full px-5 "}
          >
            Questions :
          </div>
          {questions?.map((question) => (
            <div key={question.id} className='w-full px-5'>
              <QuestionItem
                key={question.id}
                value={question.stat}
                label={question.name}
                toolTipText={question.toolTipText}
                options={question?.options}
                smallerText={question.smallerText}
                candidate={question.candidate}
              />
            </div>
          ))}
        </>
      )}
      <div key={label} className='px-4 py-5 sm:p-6'></div>
    </div>
  );
};

export default AnalyticsCard;

const QuestionItem: React.FC<QuestionItemProps> = ({
  value,
  label,
  toolTipText,
  trend,
  smallerText,
  options,
  candidate,
}) => (
  <div className='bg-white rounded-md  w-full ounded-md border-2 mt-3 mb-5 transition-opacity duration-200'>
    <div key={label} className='px-2 py-2 sm:p-6'>
      <dt className='inline-flex w-full justify-between text-lg font-normal text-gray-900 has-tooltip'>
        {label}{" "}
        {toolTipText && (
          <QuestionMarkCircleIcon className='w-4 h-4 ml-1 text-red hover:text-ui-gray-dark' />
        )}
        {toolTipText && (
          <span className='flex p-1 px-4 -mt-6 -ml-8 text-xs text-center text-white bg-gray-600 rounded shadow-lg grow tooltip'>
            {toolTipText}
          </span>
        )}
      </dt>
      <dd className='flex items-baseline justify-between mt-1 md:block lg:flex-col'>
        <div
          className={classNames(
            smallerText ? "text-lg" : "text-xl",
            "flex items-baseline text-xl font-semibold text-gray-800"
          )}
        >
          {value} réponses
        </div>

        {options?.length &&
          options.map(({ label, candidates }, index) => {
            const trend = Math.round((candidates / candidate.length) * 100);
            return (
              <div
                key={index}
                className={classNames(
                  trend >= 50
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800",
                  "inline-flex items-baseline px-2.5 py-0.5 mr-5 rounded-full text-sm font-medium md:mt-2 lg:mt-0 lg:mt-3"
                )}
              >
                {" "}
                {label}
                <span className='sr-only'>
                  {trend >= 0 ? "Increased" : "Decreased"}
                </span>{" "}
                {` : ${candidates}/${candidate.length} `}
                ({trend}%)
              </div>
            );
          })}
      </dd>
    </div>
  </div>
);
