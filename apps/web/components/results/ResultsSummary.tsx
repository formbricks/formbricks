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
  const { submissionSessions, isLoadingSubmissionSessions } = useSubmissionSessions(formId);

  const { form, isLoadingForm } = useForm(formId);

  const insights = useMemo(() => {
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
    if (insights) {
      return [
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: insights.totalSubmissions || "--",
          trend: undefined,
          toolTipText: undefined,
        },
        {
          id: "lastSubmission",
          name: "Last Submission",
          stat: insights.lastSubmissionAt ? timeSince(insights.lastSubmissionAt) : "--",
          smallerText: true,
          toolTipText: undefined,
        },
      ];
    }
  }, [insights]);

  if (!summary || !insights) {
    return <Loading />;
  }

  return (
    <>
      <h2 className="text-ui-gray-dark mt-8 text-xl font-bold">Responses Overview</h2>
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
      <div>
        {summary?.pages &&
          summary.pages.map(
            (page) =>
              page.type === "form" && (
                <div key={page.name}>
                  {page.elements.map((element) =>
                    ["email", "number", "phone", "text", "textarea", "website"].includes(element.type) ? (
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
