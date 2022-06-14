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
