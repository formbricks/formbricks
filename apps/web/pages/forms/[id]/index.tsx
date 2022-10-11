import { getSession } from "next-auth/react";
import Loading from "../../../components/Loading";
import { formHasOwnership } from "../../../lib/api";
import { prisma } from "database";

export default function FormIndex() {
  return <Loading />;
}

export async function getServerSideProps({ req, params, resolvedUrl }) {
  const session = await getSession({ req });
  if (!session) {
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${encodeURIComponent(resolvedUrl)}`,
        statusCode: 302,
      },
    };
  }
  const formId = params.id.toString();
  const ownership = await formHasOwnership(session, formId);
  if (!ownership) {
    return {
      redirect: {
        destination: resolvedUrl,
        statusCode: 404,
      },
    };
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
    };
  } else {
    // redirect to /form if there isn't one submissionSession
    return {
      redirect: {
        permanent: false,
        destination: `/forms/${formId}/form`,
      },
    };
  }
}
