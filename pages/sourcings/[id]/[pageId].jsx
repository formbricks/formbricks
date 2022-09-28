/* eslint-disable react-hooks/rules-of-hooks */
import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import usePages from "../../../hooks/usePages";
import { useNoCodeFormPublic } from "../../../lib/noCodeForm";
import Loading from "../../../components/Loading";
import App from "../../../components/frontend/App";
import withAuthentication from "../../../components/layout/WithAuthentication";

function Form() {
  const session = useSession();
  const router = useRouter();
  const pageId = router.query.pageId?.toString();
  const formId = router.query.id?.toString();
  const { user } = session.data;
  let startDate = new Date();

  const {
    noCodeForm,
    isLoadingNoCodeForm,
    isErrorNoCodeForm,
    candidateSubmissions,
  } = useNoCodeFormPublic(formId);

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }
  if (isErrorNoCodeForm) {
    return (
      <div className="flex min-h-screen bg-ui-gray-light">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-sm p-8 mx-auto lg:w-96">
            <div>
              <Image
                src="/img/kda_logo.svg"
                alt="kinshasa digital academy logo"
                width={500}
                height={89}
              />
            </div>
            <div className="mt-8">
              <h1 className="mb-4 font-bold text-center leading-2">
                something went wrong
              </h1>
              <p className="text-center">
                Got To <Link href="/sourcings">Dashboard</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSubmission = candidateSubmissions.find(
    (submission) =>
      submission.data.candidateId === user.id &&
      submission.data.pageName === pageId
  );

  const startFom = async () => {
    if (!currentSubmission) {
      const submissionSessionRes = await fetch(
        `/api/forms/${formId}/submissionSessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const submissionSession = await submissionSessionRes.json();
      // send answer to snoop platform
      await fetch(`/api/forms/${formId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              type: "pageSubmission",
              data: {
                pageName: pageId,
                submissionSessionId: submissionSession.id,
                startDate: new Date(),
              },
            },
          ],
        }),
      });
    } else {
      startDate = new Date(currentSubmission.data.startDate);
    }
  };

  startFom();

  const pages = usePages({ blocks: noCodeForm.blocks, formId: formId });

  const currentPages = pages.find((page) => page.id === pageId);

  return <App page={currentPages} formId={formId} startDate={startDate} />;
}

export default withAuthentication(Form);
