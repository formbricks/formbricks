import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import LayoutFormResults from "../../../components/layout/LayoutFormResults";
import Loading from "../../../components/Loading";
import ResultsDashboard from "../../../components/results/ResultsDashboard";
import ResultsResponses from "../../../components/results/ResultsResponses";
import { useForm } from "../../../lib/forms";

export default function Share() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);
  const [resultMode, setResultMode] = useState<string>("dashboard");

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
<<<<<<< HEAD
      <LayoutFormResults
        title={form.title}
        formId={formId}
        currentStep="results"
        resultMode={resultMode}
        setResultMode={setResultMode}
      >
        {resultMode === "dashboard" && <ResultsDashboard />}
        {resultMode === "responses" && (
          <>
            <ResultsResponses formId={formId} />
          </>
        )}
      </LayoutFormResults>
=======
      <LayoutResults title={form.title} formId={formId} currentStep="results">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-darkgray-700">
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
>>>>>>> 1658eb9 (colors, login, UI, fonts)
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
