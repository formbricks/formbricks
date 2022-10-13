import Image from "next/image";
import { useMemo } from "react";
import { getSubmissionAnalytics, useSubmissionSessions } from "../../lib/submissionSessions";
import { timeSince } from "../../lib/utils";
import Loading from "../Loading";
import AnalyticsCard from "./AnalyticsCard";

export default function ResultsAnalytics({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } = useSubmissionSessions(formId);

  const analytics = useMemo(() => {
    if (!isLoadingSubmissionSessions) {
      return getSubmissionAnalytics(submissionSessions);
    }
  }, [isLoadingSubmissionSessions, submissionSessions]);

  const stats = useMemo(() => {
    if (analytics) {
      return [
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: analytics.totalSubmissions || "--",
          trend: undefined,
          toolTipText: undefined,
        },
        {
          id: "lastSubmission",
          name: "Last Submission",
          stat: analytics.lastSubmissionAt ? timeSince(analytics.lastSubmissionAt) : "--",
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
      <h2 className="text-ui-gray-dark text-xl font-bold">Analytics</h2>
      <div>
        <dl className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
      <div className="flex items-end">
        <h2 className="text-ui-gray-dark mt-16 text-xl font-bold">Optimize Form</h2>
        <div className="ml-2 rounded-sm bg-green-50 px-3 py-2 text-xs text-green-800">
          <p>coming soon</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-10">
        <div className="rounded-md bg-white p-5 shadow-md">
          <Image
            src="/../../img/drop-offs-v1.svg"
            alt="drop-off"
            layout="responsive"
            width={500}
            height={273}
          />
        </div>
        <div className="rounded-md bg-white p-5 shadow-md">
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
