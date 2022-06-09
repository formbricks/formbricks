import { useForm } from "../../lib/forms";
import Loading from "../Loading";

export default function Submission({ formId, submissionSession }) {
  const { form, mutateForm, isLoadingForm } = useForm(formId);
  if (isLoadingForm) {
    return <Loading />;
  }

  // fill the schema with the values provided by the user
  const getSubmission = (submissionSession, schema) => {
    console.log("schema", JSON.stringify(schema, null, 2));
    console.log(
      "submissionSession",
      JSON.stringify(submissionSession, null, 2)
    );
    if (!schema) return {};
    const submission = { ...schema };
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

  return (
    <div className="bg-white shadow sm:rounded-lg max-w-">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-gray-900 whitespace-pre-wrap">
          {JSON.stringify(
            getSubmission(submissionSession, form.schema),
            null,
            2
          )}
        </h3>
      </div>
    </div>
  );
}
