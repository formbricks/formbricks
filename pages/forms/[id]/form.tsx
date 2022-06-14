import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import FormOnboardingModal from "../../../components/build/FormOnboardingModal";
import LayoutResults from "../../../components/layout/LayoutResults";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";

export default function FormPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);
  const [openOnboardingModal, setOpenOnboardingModal] = useState(false);

  useEffect(() => {
    if (form && !form.finishedOnboarding) {
      setOpenOnboardingModal(true);
    }
  }, [isLoadingForm]);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      <LayoutResults title={form.title} formId={formId} currentStep="form">
        <div>Form</div>
        <FormOnboardingModal
          open={openOnboardingModal}
          setOpen={setOpenOnboardingModal}
          formId={formId}
        />
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
