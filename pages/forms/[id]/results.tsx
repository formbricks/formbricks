import { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { getSession } from "next-auth/react";
import LayoutResults from "../../../components/layout/LayoutResults";
import { Form } from "../../../lib/types";
import { useForm } from "../../../lib/forms";
import Loading from "../../../components/Loading";
import FormOnboardingModal from "../../../components/build/FormOnboardingModal";
import { useAnswerSessions } from "../../../lib/submissionSessions";
import Submission from "../../../components/results/Submission";

type ShareProps = {};

export default function Share({}: ShareProps) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, mutateForm, isLoadingForm } = useForm(router.query.id);
  const { submissionSessions, mutateAnswerSessions, isLoadingAnswerSessions } =
    useAnswerSessions(form?.id);
  const [openOnboardingModal, setOpenOnboardingModal] = useState(false);

  useEffect(() => {
    if (form && !form.finishedOnboarding) {
      setOpenOnboardingModal(true);
    }
  }, [isLoadingForm]);

  if (isLoadingForm || isLoadingAnswerSessions) {
    return <Loading />;
  }

  return (
    <>
      <LayoutResults title={form.title} formId={formId}>
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
        <FormOnboardingModal
          open={openOnboardingModal}
          setOpen={setOpenOnboardingModal}
          formId={formId}
        />
      </LayoutResults>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({
  req,
  res,
  query,
}) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
