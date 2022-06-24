import { ClockIcon, InboxIcon, UsersIcon } from "@heroicons/react/outline";
import { useMemo } from "react";
import {
  getSubmissionAnalytics,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { timeSince } from "../../lib/utils";
import AnalyticsCard from "../layout/AnalyticsCard";
import Image from "next/image";

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
          stat: analytics.uniqueUsers || "NaN",
          toolTipText: "placeholder",
          trend: "12",
        },
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: analytics.totalSubmissions || "NaN",
          trend: "10",
        },
        {
          id: "lastSubmission",
          name: "Last Submission",
          stat: timeSince(analytics.lastSubmissionAt) || "-",
          typeText: true,
        },
      ];
    }
  }, [analytics]);
  return (
    <main>
      <div className="max-w-5xl mx-auto sm:px-6 lg:px-8">
        <h2 className="mt-8 text-xl font-bold text-ui-gray-dark">Analytics</h2>
        <div>
          {stats ? (
            <dl className="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((item) => (
                <AnalyticsCard
                  key={item.id}
                  KPI={item.stat}
                  label={item.name}
                  toolTipText={item.toolTipText}
                  typeText={item.typeText}
                  trend={item.trend}
                />
              ))}
            </dl>
          ) : null}
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
          <div className="relative p-8 bg-white rounded-md shadow-md h-60">
            <Image
              src="/../../img/drop-offs-v1.svg"
              alt="drop-off"
              objectFit="cover"
              layout="fill"
              className="rounded-md"
            />
          </div>
          <div className="relative p-8 bg-white rounded-md shadow-md h-60">
            <Image
              src="/../../img/a-b-test-v1.svg"
              alt="drop-off"
              objectFit="cover"
              layout="fill"
              className="rounded-md"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
