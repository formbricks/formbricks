import Image from "next/image";
import { useMemo } from "react";
import {
  getSubmissionAnalytics,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { timeSince } from "../../lib/utils";
import Loading from "../Loading";
import AnalyticsCard from "./AnalyticsCard";

export default function ResultsAnalytics({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId);

  const analytics = useMemo(() => {
    if (!isLoadingSubmissionSessions) {
      return getSubmissionAnalytics(submissionSessions);
    }
  }, [isLoadingSubmissionSessions, submissionSessions]);

  const stats = useMemo(() => {
    if (analytics) {
      return [
        {
          id: "uniqueUsers",
          name: "Unique Users",
          stat: analytics.uniqueUsers || "--",
          toolTipText: "Tracked without cookies using fingerprinting technique",
          trend: undefined,
        },
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: analytics.totalSubmissions || "--",
          trend: undefined,
        },
        {
          id: "lastSubmission",
          name: "Last Submission",
          stat: timeSince(analytics.lastSubmissionAt) || "--",
          smallerText: true,
        },
      ];
    }
  }, [analytics]);

  if (!stats || !analytics) {
    return <Loading />;
  }

  return (
    <>
      <h2 className="mt-8 text-xl font-bold text-ui-gray-dark">Analytics</h2>
      <div>
        <dl className="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2 lg:grid-cols-3">
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
        <h2 className="mt-16 text-xl font-bold text-ui-gray-dark">
          Optimize Form
        </h2>
        <div className="px-3 py-2 ml-2 text-xs text-green-800 rounded-sm bg-green-50">
          <p>coming soon</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-10 mt-8">
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
    </>
  );
}
