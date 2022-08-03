import { useMemo } from "react";
import { useForm } from "../../lib/forms";
import {
  getSubmissionAnalytics,
  getSubmissionSummary,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { SubmissionSummary } from "../../lib/types";
import { timeSince } from "../../lib/utils";
import AnalyticsCard from "./AnalyticsCard";
import Loading from "../Loading";
import TextResults from "./summary/TextResults";
import ChoiceResults from "./summary/ChoiceResults";

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
          stat: analytics.lastSubmissionAt
            ? timeSince(analytics.lastSubmissionAt)
            : "--",
          smallerText: true,
        },
      ];
    }
  }, [analytics]);

  if (!summary || !analytics) {
    return <Loading />;
  }

  return (
    <>
      <h2 className="mt-8 text-xl font-bold text-ui-gray-dark">
        Responses Overview
      </h2>
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
      <div>
        {summary?.pages &&
          summary.pages.map(
            (page) =>
              page.type === "form" && (
                <div key={page.name}>
                  {page.elements.map((element) =>
                    [
                      "email",
                      "number",
                      "phone",
                      "text",
                      "textarea",
                      "website",
                    ].includes(element.type) ? (
                      <TextResults element={element} />
                    ) : ["checkbox", "radio"].includes(element.type) ? (
                      <ChoiceResults element={element} />
                    ) : null
                  )}
                </div>
              )
          )}
      </div>
    </>
  );
}
