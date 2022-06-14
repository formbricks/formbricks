import { useRouter } from "next/router";
import { useEffect } from "react";
import Loading from "../../../components/Loading";
import { useSubmissionSessions } from "../../../lib/submissionSessions";

export default function FormIndex() {
  const router = useRouter();
  const formId = router.query.id;
  const { submissionSessions, isLoadingSubmissionSessions } =
    useSubmissionSessions(formId?.toString());

  useEffect(() => {
    if (!isLoadingSubmissionSessions) {
      // redirect to /results if there is at least one submissionSession
      if (submissionSessions.length > 0) {
        router.push(`/forms/${formId}/results`);
      } else {
        // redirect to /form if there isn't one submissionSession
        router.push(`/forms/${formId}/form`);
      }
    }
  }, [isLoadingSubmissionSessions]);

  return <Loading />;
}
