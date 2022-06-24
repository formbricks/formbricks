import { useMemo } from "react";
import { useForm } from "../../lib/forms";
import {
  getSubmissionAnalytics,
  getSubmissionSummary,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { SubmissionSummary } from "../../lib/types";
import { timeSince } from "../../lib/utils";
import AnalyticsCard from "../layout/AnalyticsCard";
import Loading from "../Loading";
import TextResults from "./summary/TextResults";

export default function ResultsSummary({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId);

  const { form, isLoadingForm } = useForm(formId);

  const analytics = useMemo(() => {
    if (!isLoadingSubmissionSessions) {
      return getSubmissionAnalytics(submissionSessions);
    }
  }, [isLoadingSubmissionSessions, submissionSessions]);

  const summary: SubmissionSummary | undefined = useMemo(() => {
    if (!isLoadingSubmissionSessions && !isLoadingForm) {
      return getSubmissionSummary(submissionSessions, form?.schema);
    }
  }, [isLoadingSubmissionSessions, submissionSessions, isLoadingForm, form]);

  const stats = useMemo(() => {
    if (analytics) {
      return [
        {
          id: "uniqueUsers",
          name: "Unique Users",
          stat: analytics.uniqueUsers || "--",
          toolTipText: "placeholder",
          trend: 12,
        },
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: analytics.totalSubmissions || "--",
          trend: 10,
        },
        {
          id: "lastSubmission",
          name: "Last Submission",
          stat: timeSince(analytics.lastSubmissionAt) || "--",
          typeText: true,
        },
      ];
    }
  }, [analytics]);

  if (!summary || !analytics) {
    return <Loading />;
  }

  return (
    <main className="bg-gray-50">
      <div className="max-w-5xl mx-auto sm:px-6 lg:px-8">
        <h2 className="mt-8 text-xl font-bold text-ui-gray-dark">
          Responses Overview
        </h2>
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
        <div>
          {summary.pages.map(
            (page) =>
              page.type === "form" && (
                <div key={page.name}>
                  {page.elements.map((element) =>
                    element.type === "text" || element.type === "textarea" ? (
                      <TextResults element={element} />
                    ) : null
                  )}
                </div>
              )
          )}
        </div>
      </div>
    </main>
  );
}
