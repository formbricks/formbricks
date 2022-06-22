import { ClockIcon, InboxIcon, UsersIcon } from "@heroicons/react/outline";
import { useMemo } from "react";
import { useForm } from "../../lib/forms";
import {
  getSubmissionSummary,
  useSubmissionSessions,
} from "../../lib/submissionSessions";
import { SubmissionSummary } from "../../lib/types";
import Loading from "../Loading";
import TextResults from "./summary/TextResults";

export default function ResultsSummary({ formId }) {
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId);

  const { form, isLoadingForm } = useForm(formId);

  const summary: SubmissionSummary | undefined = useMemo(() => {
    if (!isLoadingSubmissionSessions && !isLoadingForm) {
      return getSubmissionSummary(submissionSessions, form?.schema);
    }
  }, [isLoadingSubmissionSessions, submissionSessions, isLoadingForm, form]);

  const stats = useMemo(() => {
    if (summary) {
      return [
        {
          id: "uniqueUsers",
          name: "Unique Users",
          stat: 10,
          icon: UsersIcon,
        },
        {
          id: "totalSubmissions",
          name: "Total Submissions",
          stat: 10,
          icon: InboxIcon,
        },
        {
          id: "uniqueUsers",
          name: "Last Submission",
          stat: 10,
          icon: ClockIcon,
        },
      ];
    }
  }, [summary]);

  if (!summary) {
    return <Loading />;
  }

  return (
    <main className="bg-gray-50">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div>
          <dl className="grid grid-cols-1 gap-5 mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.id}
                className="relative px-4 bg-white rounded-lg shadow pt-5overflow-hidden sm:pt-6 sm:px-6"
              >
                <dt>
                  <div className="absolute p-3 rounded-md bg-snoopred-500">
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
                  <p className="text-xl font-semibold text-gray-800">
                    {item.stat}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <hr className="my-8" />
        <div>
          {summary.pages.map(
            (page, pageIdx) =>
              page.type === "form" && (
                <div key={page.name}>
                  <h2 className="text-xl font-bold text-gray-700">
                    Page {pageIdx + 1}
                  </h2>
                  {page.elements.map((element) =>
                    element.type === "text" || element.type === "textarea" ? (
                      <TextResults element={element} />
                    ) : null
                  )}
                  <hr className="my-8" />
                </div>
              )
          )}
        </div>
      </div>
    </main>
  );
}
