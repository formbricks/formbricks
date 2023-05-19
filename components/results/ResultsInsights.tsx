import Image from "next/image";
import { useMemo } from "react";
import {
  getSubmissionAnalytics,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { getFormPages, timeSince } from "../../lib/utils";
import Loading from "../Loading";
import AnalyticsCard from "./AnalyticsCard";
import { useNoCodeForm, useNoCodeFormPublic } from "../../lib/noCodeForm";

export default function ResultsAnalytics({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId);

    const {blocks} = useNoCodeForm (formId);

  const analytics = useMemo(() => {
    if (!isLoadingSubmissionSessions) {
      return getSubmissionAnalytics(submissionSessions, getFormPages(blocks, formId));
    }
  }, [isLoadingSubmissionSessions, submissionSessions]);

  const stats = useMemo(() => {
    if (analytics) {
      return [
        {
          id: "totalSubmissions",
          name: "Nombre total de soumissions",
          stat: analytics.totalSubmissions || "--",
          trend: undefined,
          toolTipText: undefined,
        },
        {
          id: "lastSubmission",
          name: "Dernière soumission",
          stat: analytics.lastSubmissionAt
            ? timeSince(analytics.lastSubmissionAt)
            : "--",
          smallerText: true,
          toolTipText: undefined,
        },
      ];
    }
  }, [analytics]);
  if (!stats || !analytics) {
    return <Loading />;
  }

  return (
    <div className="my-8">
      <h2 className="text-xl font-bold text-ui-gray-dark max-sm:pl-4 max-sm:pr-4 max-md:pl-4 ">Analytics</h2>
      <div>
        <dl className="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2">
          {stats.map((item) => (
            <AnalyticsCard
              key={item.id}
              value={item.stat}
              label={item.name}
              toolTipText={item.toolTipText}
              trend={item.trend}
              smallerText={item.smallerText}
            />
          ))}
        </dl>
      </div>
      <div className="flex items-end max-sm:pl-4 max-md:pl-4">
        <h2 className="mt-16 text-xl font-bold text-ui-gray-dark">
          Optimize Form
        </h2>
        <div className="px-3 py-2 ml-2 text-xs text-green-800 rounded-sm bg-green-50">
          <p>Bientôt disponible</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-10 mt-8 max-sm:pl-4 max-md:pl-4 max-sm:pr-4 max-md:pr-4">
        <div className="p-5 bg-white rounded-md shadow-md">
          <Image
            src="/../../img/drop-offs-v1.svg"
            alt="drop-off"
            layout="responsive"
            width={500}
            height={273}
          />
        </div>
        <div className="p-5 bg-white rounded-md shadow-md">
          <Image
            src="/../../img/a-b-test-v1.svg"
            alt="drop-off"
            layout="responsive"
            width={500}
            height={273}
          />
        </div>
      </div>
    </div>
  );
}
