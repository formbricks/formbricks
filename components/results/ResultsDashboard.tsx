import { ClockIcon, InboxIcon, UsersIcon } from "@heroicons/react/outline";
import { useMemo } from "react";
import {
  getSubmissionAnalytics,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { timeSince } from "../../lib/utils";

export default function ResultsDashboard({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId);

  const analytics = useMemo(() => {
    if (!isLoadingSubmissionSessions) {
      return getSubmissionAnalytics(submissionSessions);
    }
  }, [isLoadingSubmissionSessions]);

  const stats = useMemo(() => {
    if (analytics) {
      return [
        {
          id: "uniqueUsers",
          name: "Unique Users",
          stat: analytics.uniqueUsers,
          icon: UsersIcon,
        },
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: analytics.totalSubmissions,
          icon: InboxIcon,
        },
        {
          id: "uniqueUsers",
          name: "Last Submission",
          stat: timeSince(analytics.lastSubmissionAt) || "-",
          icon: ClockIcon,
        },
      ];
    }
  }, [analytics]);
  return (
    <main>
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div>
          {stats ? (
            <dl className="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((item) => (
                <div
                  key={item.id}
                  className="relative px-4 bg-white rounded-lg shadow pt-5overflow-hidden sm:pt-6 sm:px-6"
                >
                  <dt>
                    <div className="absolute p-3 bg-red-500 rounded-md">
                      <item.icon
                        className="w-6 h-6 text-white"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="ml-16 text-sm font-medium text-gray-500 truncate">
                      {item.name}
                    </p>
                  </dt>
                  <dd className="flex items-baseline ml-16 sm:pb-7">
                    <p className="text-2xl font-semibold text-gray-900">
                      {item.stat}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </main>
  );
}
