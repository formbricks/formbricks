import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/solid";
import { Chip } from "@mui/material";
import React, { useState, useEffect } from "react";
import {
  getPageQuestionsDatas,
  getPageQuestionsStats,
} from "../../lib/submissionSessions";
import { CSVLink } from "react-csv";
import { classNames } from "../../lib/utils";
import Loading from "../Loading";

type QuestionStatType = {
  candidates: any;
  qStats: any;
} | null;

interface Props {
  value: string | number;
  label: string;
  toolTipText: string;
  trend?: number;
  smallerText?: boolean;
  questions: { id: string; data: any; type: string }[];
  formId?: string;
  pageId?: string;
  formName: string;
}

interface QuestionItemProps {
  label: string;
  toolTipText: string;
  trend?: number;
  smallerText?: boolean;
  options: { label: string; candidates: number }[];
  respondants: number;
}

const AnalyticsCard: React.FC<Props> = ({
  value,
  label,
  toolTipText,
  trend,
  smallerText,
  questions,
  formId,
  pageId,
  formName,
}) => {
  const [isLoadingQuestionStats, setIsLoadingQuestionStats] = useState(true);
  const [isItemOpened, setIsItemOpened] = useState(false);
  const [stepStats, setStepStats] = useState();
  const [headers, setHeaders] = useState([]);
  const [questionsStats, setQuestionsStats] = useState<QuestionStatType>(null);
  const regexPattern = /[^A-Za-z0-9]/g;
  const fileTitle = `${formName} _ ${label ? label.replace(
    regexPattern,
    "_"
  ) : ""}_${new Date()}`;

  useEffect(() => {
    if (isItemOpened) {
      getPageQuestionsStats(formId, pageId)
        .then((res) => res.json())
        .then((data) => {
          setQuestionsStats(data.qStats);

          setIsLoadingQuestionStats(false);
        });

      getPageQuestionsDatas(formId, pageId, label)
        .then((res) => res.json())
        .then(({ Data, headerConfig }) => {
          setHeaders(headerConfig);
          setStepStats(Data);
        });
    }
  }, [isItemOpened]);

  return (
    <div
      className={`bg-white  rounded-md shadow-md flex justify-center flex-wrap transition-opacity duration-200 ${
        isItemOpened && questions.length ? "pb-5" : "pb-5"
      } ${questions?.length ? "cursor-pointer" : ""}`}
    >
      <div
        onClick={() => {
          if (questions?.length) {
            setIsItemOpened(!isItemOpened);
          }
        }}
        key={label}
        className="px-4 py-5 sm:p-6 w-full"
      >
        <dt className="inline-flex w-full justify-between text-xl font-semibold text-gray-900 has-tooltip">
          {label}{" "}
          {toolTipText && (
            <QuestionMarkCircleIcon className="w-4 h-4 ml-1 text-red hover:text-ui-gray-dark" />
          )}
          {toolTipText && (
            <span className="flex p-1 px-4 -mt-6 -ml-8 text-xs text-center text-white bg-gray-600 rounded shadow-lg grow tooltip">
              {toolTipText}
            </span>
          )}
          <div className="flex">
            {!questions?.length ? null : !isItemOpened ? (
              <>
                <ChevronDownIcon
                  className="ml-5   mr-0.5 flex-shrink-0 self-center h-5 w-5 "
                  aria-hidden="true"
                />
              </>
            ) : (
              <>
                <ChevronUpIcon
                  className="ml-5   mr-0.5 flex-shrink-0 self-center h-5 w-5 "
                  aria-hidden="true"
                />
              </>
            )}
          </div>
        </dt>
        <dd className="flex items-baseline justify-between mt-1 md:block lg:flex">
          <div
            className={classNames(
              smallerText ? "text-lg" : "text-lg",
              "flex items-baseline text-md font-semibold text-gray-300 mt-3"
            )}
          >
            {value || 0}
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
                  className="-ml-1 mr-0.5 flex-shrink-0 self-center h-5 w-5 text-green-500"
                  aria-hidden="true"
                />
              ) : (
                <ArrowDownIcon
                  className="-ml-1 mr-0.5 flex-shrink-0 self-center h-5 w-5 text-red-500"
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">
                {trend >= 0 ? "Increased" : "Decreased"} by
              </span>
              {trend} %
            </div>
          )}
        </dd>
      </div>
      {!questions?.length || !isItemOpened ? null : isLoadingQuestionStats ? (
        <Loading />
      ) : (
        <>
          <div
            className={
              "flex items-baseline text-lg font-normal text-gray-800 w-full px-5 mb-5 "
            }
          >
            <div className={`${!stepStats ? "pointer-events-none" : ""}`}>
              <CSVLink
                filename={fileTitle}
                headers={headers}
                data={stepStats || []}
              >
                <div className="cursor-pointer ">
                  <Chip
                    disabled={stepStats ? false : true}
                    label="Exporter"
                    onClick={() => console.log("exported")}
                    color="success"
                  />
                </div>
              </CSVLink>
            </div>
          </div>

          <div
            className={
              "flex items-baseline text-lg font-normal text-gray-800 w-full px-5 "
            }
          >
            Questions :
          </div>
          {Object.keys(questionsStats).map((qId) => {
            const qOptions = Object.keys(questionsStats[qId])
              .map((k) => {
                return { label: k, candidates: questionsStats[qId][k] };
              })
              .sort((b, a) => a.candidates - b.candidates);
            const q = questions.find((question) => question.id === qId);

            if (q?.type !== "multipleChoiceQuestion") return;
            const getNumberOfResponses = () => {
              return qOptions.reduce((a, v) => a + v.candidates, 0);
            };

            return (
              <div key={`qline-${qId}`} className="w-full px-5">
                <QuestionItem
                  key={`qitem-${qId}`}
                  label={q.data.label}
                  toolTipText={qId}
                  options={qOptions}
                  smallerText={false}
                  respondants={getNumberOfResponses()}
                />
              </div>
            );
          })}
        </>
      )}
      <div key={label} className="px-4 py-5 sm:p-6"></div>
    </div>
  );
};

export default AnalyticsCard;

const QuestionItem: React.FC<QuestionItemProps> = ({
  // value,
  label,
  toolTipText,
  trend,
  smallerText,
  options,
  respondants,
}) => (
  <div className="bg-white rounded-md  w-full ounded-md border-2 mt-3 mb-5 transition-opacity duration-200">
    <div key={label} className="px-2 py-2 sm:p-6">
      <dd className="flex items-baseline justify-between mt-1 md:block lg:flex-col">
        <div
          className={classNames(
            smallerText ? "text-lg" : "text-xl",
            "flex items-baseline text-xl font-semibold text-gray-800"
          )}
        >
          {`${label} (${respondants} réponses)`}
        </div>

        {options?.length &&
          options.map(({ label, candidates }, index) => {
            const trend = ((candidates / respondants) * 100).toFixed(2);
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
                <span className="sr-only">
                  {trend >= 0 ? "Increased" : "Decreased"}
                </span>{" "}
                {` : ${candidates}/${respondants} `}({trend}%)
              </div>
            );
          })}
      </dd>
    </div>
  </div>
);
