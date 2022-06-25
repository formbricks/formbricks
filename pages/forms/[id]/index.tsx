import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import Loading from "../../../components/Loading";
import { formHasOwnership } from "../../../lib/api";
import { prisma } from "../../../lib/prisma";

export default function FormIndex() {
  return <Loading />;
}

export const getServerSideProps: GetServerSideProps = async ({
  req,
  res,
  params,
}) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
    return { props: {} };
  }
  const formId = params.id.toString();
  const ownership = await formHasOwnership(session, formId);
  if (!ownership) {
    res.statusCode = 403;
    return { props: {} };
  }
  // redirect based on number of submissionSession
  const submissionSessionsData = await prisma.submissionSession.findMany({
    where: {
      form: { id: formId },
    },
  });
  if (submissionSessionsData.length > 0) {
    return {
      redirect: {
        permanent: false,
        destination: `/forms/${formId}/results/summary`,
      },
      props: {},
    };
  } else {
    // redirect to /form if there isn't one submissionSession
    return {
      redirect: {
        permanent: false,
        destination: `/forms/${formId}/form`,
      },
      props: {},
    };
  }
};
