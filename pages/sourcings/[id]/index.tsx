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
import { isTimedPage } from "../../../lib/utils";
import {
  CheckCircleIcon,
  InboxArrowDownIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { FormOrder } from "@prisma/client";

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
      <MessagePage text="Form not found. Are you sure this is the right URL?" />
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
          `Vous êtes sur le point de commencer un formulaire chronométré et vous disposez de ${getPageTimer(
            page.blocks
          )} minutes pour remplir ce formulaire. Une fois commencé, vous ne pouvez plus quitter le formulaire, sous peine de voir vos réponses considérées comme soumises.`
        );
      } else router.push(`/sourcings/${formId}/${page.id}`);
    } else {
      router.push(`/sourcings/${formId}/${pageIdOnModal}`);
    }
  };

  return (
    <BaseLayoutManagement
      title={"Forms - KDA Sourcing"}
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
        <div className="flex flex-col justify-between h-screen bg-white">
          {noCodeForm.closed ? (
            <div className="flex min-h-screen bg-ui-gray-light">
              <div className="flex flex-col justify-center flex-1 px-4 py-12 mx-auto sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                <div className="w-full max-w-sm p-8 mx-auto lg:w-96">
                  <div>
                    <Image
                      src="/img/kda_logo.png"
                      alt="kinshasa digital academy logo"
                      width={180}
                      height={60}
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
            <div className="flex-col">
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
              <p className="text-lg mb-3 ml-12  mr-11">
                {noCodeForm.form.description}
              </p>
              {pages.map((page, index) => {
                if (pages.length - 1 !== index)
                  return (
                    <div
                      className="w-full py-4 border-y-2 border-slate-100 flex justify-between  max-sm:flex-col max-md:flex-col"
                      key={index}
                    >
                      <div className="pl-12 flex items-center">
                        {pageIsCompleted(page.id) ? (
                          <CheckCircleIcon className="text-green-800 w-7 mr-2" />
                        ) : (
                          <XCircleIcon className="text-red-800 w-7 mr-2" />
                        )}
                      </div>
                      <div className="pl-12 flex items-center max-sm:pl-6 max-sm:pr-6 max-sm:pb-5 max-md:pb-5 max-sm:font-semibold max-md:font-semibold max-md:pl-6 max-md:pr-6">
                        {page.length ? "" : page.blocks[0].data.text}
                      </div>
                      <div className="flex items-center justify-between w-2/5 pr-8 max-sm:w-full max-md:w-full max-sm:pl-6 max-sm:pr-6 max-sm:flex-col max-sm:items-start max-md:pl-6 max-md:pr-6">
                        <div className="flex items-center w-3/8 max-sm:pb-5 max-md:pb-5  ">
                          {isTimedPage(page) ? (
                            <>
                              <span className="flex items-center mr-7 text-gray-800">
                                <ClockIcon className="w-7 mr-2" />
                                {getPageTimer(page.blocks)} min.
                              </span>
                              <span className="flex items-center text-gray-800">
                                <InboxArrowDownIcon className="w-5 mr-2" />1
                                tentative
                              </span>
                            </>
                          ) : (
                            <></>
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
