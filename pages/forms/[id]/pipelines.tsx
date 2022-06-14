import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import LayoutResults from "../../../components/layout/LayoutResults";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";

export default function PipelinesPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      <LayoutResults title={form.title} formId={formId} currentStep="pipelines">
        <div>Pipelines</div>
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
