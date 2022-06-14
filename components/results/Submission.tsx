import { useMemo } from "react";
import { useForm } from "../../lib/forms";
import { convertDateTimeString } from "../../lib/utils";
import Loading from "../Loading";

export default function Submission({ formId, submissionSession }) {
  const { form, isLoadingForm } = useForm(formId);

  // fill the schema with the values provided by the user
  const getSubmission = (submissionSession, schema) => {
    if (!schema) return {};
    const submission = JSON.parse(JSON.stringify(schema));
    submission.id = submissionSession.id;
    submission.createdAt = submissionSession.createdAt;
    if (submissionSession.events.length > 0) {
      for (const page of submission.pages) {
        if (page.type === "form") {
          const pageSubmission = submissionSession.events.find(
            (s) => s.type === "pageSubmission" && s.data?.pageName === page.name
          );
          if (typeof pageSubmission !== "undefined") {
            for (const element of page.elements) {
              if (element.type !== "submit") {
                if (element.name in pageSubmission.data?.submission) {
                  element.value = pageSubmission.data.submission[element.name];
                }
              }
            }
          }
        }
      }
    }
    return submission;
  };

  const submission = useMemo(() => {
    if (form && submissionSession) {
      return getSubmission(submissionSession, form.schema);
    }
  }, [form, submissionSession]);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <div className="bg-white shadow sm:rounded-lg max-w-">
      <div className="px-4 py-5 sm:p-6">
        <div className="text-darkgray-500-600">
          <p className="text-sm">
            {convertDateTimeString(submission.createdAt)}
          </p>
          {submission.pages.map((page) => (
            <div key={page.name}>
              {page.elements?.map(
                (element) =>
                  element.type !== "submit" && (
                    <div key={element.name}>
                      <p className="font-semibold text-snoopred">
                        {element.label}
                      </p>
                      <p className="font-normal">
                        {element.value || "[not provided]"}
                      </p>
                    </div>
                  )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
