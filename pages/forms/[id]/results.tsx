import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import LayoutResults from "../../../components/layout/LayoutResults";
import Loading from "../../../components/Loading";
import Submission from "../../../components/results/Submission";
import { useForm } from "../../../lib/forms";
import { useAnswerSessions } from "../../../lib/submissionSessions";

export default function Share() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);
  const { submissionSessions, isLoadingAnswerSessions } = useAnswerSessions(
    form?.id
  );

  if (isLoadingForm || isLoadingAnswerSessions) {
    return <Loading />;
  }

  return (
    <>
      <LayoutResults title={form.title} formId={formId} currentStep="results">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Submissions for your form
            </h3>
            <p>Number of submissions: {submissionSessions.length}</p>
          </div>
        </div>
        <div className="grid gap-8 mt-8">
          {submissionSessions.map((submissionSession) => (
            <Submission
              key={submissionSession.id}
              submissionSession={submissionSession}
              formId={formId}
            />
          ))}
        </div>
      </LayoutResults>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
