import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import App from "../../components/frontend/App";
import Loading from "../../components/Loading";
import { useForm } from "../../lib/forms";

export default function Share({}) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(formId);

  if (isLoadingForm) {
    return <Loading />;
  }

  if (form.formType !== "NOCODE") {
    return (
      <div>
        Form Frontend is only avaiblable for Forms built with No-Code-Editor
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>SnoopForms</title>
      </Head>
      <App formId={formId} />
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
