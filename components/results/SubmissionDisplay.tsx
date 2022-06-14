import { useMemo } from "react";
import { useForm } from "../../lib/forms";
import { getSubmission } from "../../lib/submissionSessions";
import { Submission } from "../../lib/types";
import { classNames } from "../../lib/utils";
import Loading from "../Loading";

export default function SubmissionDisplay({ formId, submissionSession }) {
  const { form, isLoadingForm } = useForm(formId);

  const submission: Submission = useMemo(() => {
    if (form && submissionSession) {
      return getSubmission(submissionSession, form.schema);
    }
  }, [form, submissionSession]);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <div className="flow-root mt-6">
      <ul role="list" className="-my-5 divide-y divide-gray-200">
        {submission.pages.map((page) =>
          page.elements?.map(
            (element) =>
              element.type !== "submit" && (
                <li key={element.name} className="py-5">
                  <p className="text-sm font-semibold text-gray-800">
                    {element.label}
                  </p>

                  <p
                    className={classNames(
                      element.value ? "text-gray-600" : "text-gray-400",
                      "mt-1 text-sm text-gray-600 line-clamp-2"
                    )}
                  >
                    {element.value || "[not provided]"}
                  </p>
                </li>
              )
          )
        )}
      </ul>
    </div>
  );
}
