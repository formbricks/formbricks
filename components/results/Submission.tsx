import { useMemo } from "react";
import { useForm } from "../../lib/forms";
import Loading from "../Loading";

export default function Submission({ formId, submissionSession }) {
  const { form, mutateForm, isLoadingForm } = useForm(formId);

  // fill the schema with the values provided by the user
  const getSubmission = (submissionSession, schema) => {
    if (!schema) return {};
    const submission = JSON.parse(JSON.stringify(schema));
    for (const page of submission.pages) {
      if (page.type === "form") {
        const pageSubmission = submissionSession.submissions.find(
          (s) => s.pageName === page.name
        );
        if (typeof pageSubmission !== "undefined") {
          for (const element of page.elements) {
            if (element.type !== "submit") {
              if (element.name in pageSubmission.data) {
                element.value = pageSubmission.data[element.name];
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
        <h3 className="text-gray-900 whitespace-pre-wrap">
          {submission.pages.map((page) => (
            <div key={page.name}>
              {page.elements?.map(
                (element) =>
                  element.type !== "submit" && (
                    <div key={element.name}>
                      <p className="font-semibold text-red-600">
                        {element.label}
                      </p>
                      <p className="font-normal text-gray-600">
                        {element.value || "[not provided]"}
                      </p>
                    </div>
                  )
              )}
            </div>
          ))}
        </h3>
      </div>
    </div>
  );
}
