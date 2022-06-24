import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import Builder from "../../../components/builder/Builder";
import FormCode from "../../../components/form/FormCode";
import LayoutFormBasics from "../../../components/layout/LayoutFormBasic";
import LayoutFormBuilder from "../../../components/layout/LayoutFormBuilder";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";

export default function FormPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);

  if (isLoadingForm) {
    return <Loading />;
  }

  if (form.formType === "NOCODE") {
    return (
      <>
        <LayoutFormBuilder title={form.name} formId={formId} currentStep="form">
          <Builder formId={formId} />
        </LayoutFormBuilder>
      </>
    );
  } else {
    return (
      <>
        <LayoutFormBasics title={form.name} formId={formId} currentStep="form">
          <FormCode formId={formId} />
        </LayoutFormBasics>
      </>
    );
  }
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
