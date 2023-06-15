/* eslint-disable react-hooks/rules-of-hooks */
import BaseLayoutManagement from "../../../components/layout/BaseLayoutManagement";
import { ClockIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import { HiOutlineLocationMarker } from "react-icons/hi";
import withAuthentication from "../../../components/layout/WithAuthentication";
import Loading from "../../../components/Loading";
import MessagePage from "../../../components/MessagePage";
import { useNoCodeFormPublic } from "../../../lib/noCodeForm";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Image from "next/image";
import getConfig from "next/config";
import usePages from "../../../hooks/usePages";
import LimitedWidth from "../../../components/layout/LimitedWidth";
import DisclaimerModal from "../../../components/form/DisclaimerModal";
import {
  isTimedPage,
  isBlockAQuestion,
  getPageSubmission,
} from "../../../lib/utils";
import {
  CheckCircleIcon,
  InboxArrowDownIcon,
  XCircleIcon,
  EllipsisHorizontalCircleIcon,
} from "@heroicons/react/24/outline";
import { FormOrder } from "@prisma/client";
import { useSession } from "next-auth/react";

const { publicRuntimeConfig } = getConfig();
const { publicPrivacyUrl, publicImprintUrl } = publicRuntimeConfig;

function NoCodeFormPublic() {
  const router = useRouter();
  const formId = router.query.id?.toString();
  const {
    noCodeForm,
    candidateRoll,
    candidateSubmissions,
    isLoadingNoCodeForm,
    isErrorNoCodeForm,
  } = useNoCodeFormPublic(formId);
  const session = useSession();

  const { user } = session.data;
  const [openDisclaimer, setOpenDisclaimer] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [pageIdOnModal, setPageIdOnModal] = useState("");
  const [roll, setRoll] = useState();

  enum options {
    year = "numeric",
    month = "long",
    day = "numeric",
  }
  const openForm = async () => {
    try {
      await fetch(`/api/forms/${formId}/open`, {
        method: "POST",
      });
    } catch (error) {}
  };

  useEffect(() => {
    openForm();
  }, []);

  useEffect(() => {
    setRoll(candidateRoll);
  }, [candidateRoll]);

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  const pages = usePages({ blocks: noCodeForm.blocks, formId: formId });

  if (isErrorNoCodeForm || !noCodeForm?.published) {
    return (
      <MessagePage text="Formulaire introuvable. Es-tu sûr d'avoir le bon lien ?" />
    );
  }

  const pageIsCompleted = (pageId: string) => {
    return candidateSubmissions
      .map((submission) => submission.data.pageName)
      .includes(pageId);
  };

  const getPageTimer = (pageBlocks: any) => {
    const timer = pageBlocks.filter((p) => p.type === "timerToolboxOption")[0];
    return timer.data.timerDuration;
  };

  const pageIsEnabled = (pageId: string) => {
    const pageIds = pages.map((p) => p.id);
    // random for even roll, sequential for odd role
    const luckyDraw =
      noCodeForm.form.answeringOrder === FormOrder.ABTEST &&
      (!!roll ? roll : 0) % 2;
    if (luckyDraw || noCodeForm.form.answeringOrder === FormOrder.SEQUENTIAL) {
      const nextChallengePageId = pageIds.find((p) => !pageIsCompleted(p));
      const nextChallengePage = pageIds.indexOf(nextChallengePageId);
      const next = nextChallengePage === -1 ? 0 : nextChallengePage;
      return next >= pageIds.indexOf(pageId);
    }
    return true;
  };

  const handleClickAction = (page, fromModal: Boolean = false) => {
    if (!fromModal) {
      if (isTimedPage(page)) {
        setOpenDisclaimer(true);
        setPageIdOnModal(page.id);
        setModalMessage(
          `Tu es sur le point de commencer un formulaire chronométré et tu disposes de ${getPageTimer(
            page.blocks
          )} minutes pour remplir ce formulaire. Une fois commencé, tu ne peux plus quitter le formulaire, sous peine de voir tes réponses considérées comme soumises.`
        );
      } else router.push(`/sourcings/${formId}/${page.id}`);
    } else {
      router.push(`/sourcings/${formId}/${pageIdOnModal}`);
    }
  };

  return (
    <BaseLayoutManagement
      title={"Forms - Kadea Sourcing"}
      breadcrumbs={[
        {
          name: `Admissions`,
          href: "/sourcings",
          current: true,
        },
        {
          name: `${noCodeForm.form.name}`,
          href: "#",
          current: true,
        },
      ]}
    >
      <LimitedWidth>
        <div className="flex flex-col justify-between h-full bg-white">
          {noCodeForm.closed ? (
            <div className="flex min-h-screen bg-ui-gray-light">
              <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                <div className="w-full max-w-sm p-8 mx-auto lg:w-96">
                  <div className="text-center">
                    <Image
                      src="/img/kadea_logo.png"
                      alt="Kadea  academy logo"
                      width={180}
                      height={40}
                    />
                  </div>
                  <div className="mt-8">
                    <h1 className="mb-4 font-bold text-center leading-2">
                      Formulaire fermé !
                    </h1>
                    <p className="text-center">
                      Ce formulaire est fermé pour toute autre soumission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm flex-col">
              <h1 className="text-2xl mt-10 mb-10 ml-12 mx-auto font-bold  max-sm:ml-6 max-md:ml-6 max-sm:mt-8 max-md:mb-8">
                {noCodeForm.form.name}
              </h1>
              <p className="flex items-center text-sm mb-10 ml-12 mx-auto max-sm:ml-6 max-md:ml-6">
                <CalendarDaysIcon className="w-6 h-6 stroke-thin mr-2" />
                <span className="font-bold mr-1">Date limite : </span>
                {new Date(noCodeForm.form.dueDate).toLocaleDateString(
                  "fr-FR",
                  options
                )}
              </p>
              {noCodeForm.form.place === "" ? (
                <></>
              ) : (
                <p className="flex  items-center text-sm mb-10 ml-12 mx-auto max-sm:ml-6 max-md:ml-6">
                  <HiOutlineLocationMarker className="w-6 h-6 stroke-thin mr-2" />
                  <span className="font-bold mr-1">Lieu : </span>
                  {noCodeForm.form.place}
                </p>
              )}

              <div
                className="text-sm mb-3 ml-12  mr-11"
                dangerouslySetInnerHTML={{
                  __html: noCodeForm.form.description,
                }}
              />

              {pages.map((page, index) => {
                let numberOfQuestions = 0;
                let numberOfAnsweredQuestions = 0;
                const pageSubmission = getPageSubmission(
                  candidateSubmissions,
                  user,
                  page
                );
                if (page) {
                  numberOfQuestions = page.blocks.filter((block) =>
                    isBlockAQuestion(block)
                  ).length;
                  numberOfAnsweredQuestions = !pageSubmission?.data?.submission
                    ? 0
                    : Object.values(pageSubmission?.data?.submission).filter(
                        (v) => v
                      ).length;
                }
                if (pages.length - 1 !== index)
                  return (
                    <div
                      className="w-full py-4 border-y-2 border-slate-100 flex justify-between  max-sm:flex-col max-md:flex-col"
                      key={index}
                    >
                      <div className="pl-12 flex items-center max-md:pl-6 max-md:pb-2">
                        {pageIsCompleted(page.id) ||
                        (!isTimedPage(page) &&
                          numberOfQuestions === numberOfAnsweredQuestions) ? (
                          <CheckCircleIcon className="text-green-800 w-7 mr-2" />
                        ) : numberOfAnsweredQuestions > 0 ? (
                          <EllipsisHorizontalCircleIcon className="text-orange-600 w-7 mr-2" />
                        ) : (
                          <XCircleIcon className="text-red-800 w-7 mr-2" />
                        )}
                      </div>
                      <div
                        className={`pl-12 ${
                          isTimedPage(page) ? "pl-16" : "pl-8"
                        } flex items-center max-sm:pl-6 max-sm:pr-6 max-sm:pb-5 max-md:pb-5 max-sm:font-semibold max-md:font-semibold max-md:pl-6 max-md:pr-6  max-md:w-5/5 md:w-2/5`}
                      >
                        {page.length ? "" : page.blocks[0].data.text}
                      </div>
                      <div className="flex items-center justify-between w-4/8 pr-8 max-sm:w-full max-md:w-full max-sm:pl-6 max-sm:pr-6 max-sm:flex-col max-sm:items-start max-md:pl-6 max-md:pr-6">
                        <div className="flex items-center w-3/8 max-sm:pb-5 max-md:pb-5  ">
                          {isTimedPage(page) ? (
                            <>
                              <span className="flex items-center mr-7 text-gray-800">
                                <ClockIcon className="w-7 mr-2" />
                                {getPageTimer(page.blocks)} min.
                              </span>
                              <span className="mr-2 flex items-center text-gray-800">
                                <InboxArrowDownIcon className="w-5 mr-2" />1
                                tentative
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="flex mr-2 items-center text-gray-800">
                                {numberOfAnsweredQuestions} /{" "}
                                {numberOfQuestions} {"questions "}
                              </span>{" "}
                            </>
                          )}
                        </div>
                        {pageIsCompleted(page.id) ? (
                          <button
                            onClick={() => handleClickAction(page)}
                            disabled={isTimedPage(page)}
                            className="w-107 rounded-full bg-green-800 p-2.5 text-white text-sm font-bold"
                          >
                            {isTimedPage(page) ? "Terminé" : "Modifier"}
                          </button>
                        ) : (
                          <button
                            disabled={!pageIsEnabled(page.id)}
                            onClick={() => handleClickAction(page)}
                            className="w-107 rounded-full bg-gray-800 p-2.5 text-white font-bold disabled:opacity-10"
                          >
                            Commencer
                          </button>
                        )}
                      </div>
                    </div>
                  );
              })}
              <DisclaimerModal
                open={openDisclaimer}
                setOpen={setOpenDisclaimer}
                message={modalMessage}
                onClick={() => handleClickAction(null, true)}
              />
            </div>
          )}
          {(publicPrivacyUrl || publicImprintUrl) && (
            <footer className="flex items-center justify-center w-full h-10 text-xs text-gray-300">
              {publicImprintUrl && (
                <>
                  <a href={publicImprintUrl} target="_blank" rel="noreferrer">
                    Impression
                  </a>
                </>
              )}
              {publicImprintUrl && publicPrivacyUrl && (
                <span className="px-2">|</span>
              )}
              {publicPrivacyUrl && (
                <a href={publicPrivacyUrl} target="_blank" rel="noreferrer">
                  Politique de confidentialité
                </a>
              )}
            </footer>
          )}
        </div>
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

NoCodeFormPublic.getInitialProps = () => {
  return {};
};

export default withAuthentication(NoCodeFormPublic);
