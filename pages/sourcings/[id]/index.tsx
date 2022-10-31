/* eslint-disable react-hooks/rules-of-hooks */
import BaseLayoutManagement from "../../../components/layout/BaseLayoutManagement";
import {
  ClockIcon,
  CalendarDaysIcon,
  InboxArrowDownIcon,
} from "@heroicons/react/24/solid";
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

const { publicRuntimeConfig } = getConfig();
const { publicPrivacyUrl, publicImprintUrl } = publicRuntimeConfig;

function NoCodeFormPublic() {
  const router = useRouter();
  const formId = router.query.id?.toString();
  const {
    noCodeForm,
    candidateSubmissions,
    isLoadingNoCodeForm,
    isErrorNoCodeForm,
  } = useNoCodeFormPublic(formId);
  const [openDisclaimer, setOpenDisclaimer] = useState(false);
  const [pageIdOnModal, setPageIdOnModal] = useState("");

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

  const handleClickAction = (page, fromModal: Boolean = false) => {
    if (!fromModal) {
      if (isTimedPage(page)) {
        setOpenDisclaimer(true);
        setPageIdOnModal(page.id);
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
          name: `Sourcings`,
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
                      Form closed!
                    </h1>
                    <p className="text-center">
                      This form is closed for any further submissions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-col">
              <h1 className="text-2xl mt-10 mb-10 ml-12 mx-auto font-bold">
                {noCodeForm.form.name}
              </h1>
              <p className="text-lg mb-3 ml-12  mr-11">
                {noCodeForm.form.description}
              </p>
              <p className="flex  items-center text-sm mb-10 ml-12 mx-auto">
                <CalendarDaysIcon className="w-6 h-6 stroke-thin mr-2" />
                <span className="font-bold mr-1">Date limite :</span>{" "}
                {new Date(noCodeForm.form.dueDate).toLocaleDateString(
                  "en-US",
                  options
                )}
              </p>
              {noCodeForm.form.place === "" ? (
                <></>
              ) : (
                <p className="flex  items-center text-sm mb-10 ml-12 mx-auto">
                  <HiOutlineLocationMarker className="w-6 h-6 stroke-thin mr-2" />
                  <span className="font-bold mr-1">Place :</span>{" "}
                  {noCodeForm.form.place}
                </p>
              )}
              {pages.map((page, index) => {
                if (pages.length - 1 !== index)
                  return (
                    <div
                      className="w-full py-4 border-y-2 border-slate-100 flex justify-between"
                      key={index}
                    >
                      <div className="pl-12 flex items-center">
                        {page.length ? "" : page.blocks[0].data.text}
                      </div>
                      <div className="flex items-center justify-between w-2/5 pr-8">
                        <div className="flex items-center w-3/8">
                          {isTimedPage(page) ? (
                            <>
                              <span className="flex items-center mr-7 text-gray-800">
                                <ClockIcon className="w-7 mr-2" />
                                {getPageTimer(page.blocks)} minutes
                              </span>
                              <span className="flex items-center text-gray-800">
                                <InboxArrowDownIcon className="w-5 mr-2" />1
                                attempt
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
                            {isTimedPage(page) ? "Completed" : "Update answer"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleClickAction(page)}
                            className="w-107 rounded-full bg-gray-800 p-2.5 text-white font-bold"
                          >
                            Start
                          </button>
                        )}
                      </div>
                      <DisclaimerModal
                        open={openDisclaimer}
                        setOpen={setOpenDisclaimer}
                        message={`You are about to start a timed form and You have ${page.blocks[1].data.timerDuration} minutes to complete this form. Once started, you cannot leave the form, under penalty of seeing your answers considered to be submitted.`}
                        onClick={() => handleClickAction(page, true)}
                      />
                    </div>
                  );
              })}
            </div>
          )}
          {(publicPrivacyUrl || publicImprintUrl) && (
            <footer className="flex items-center justify-center w-full h-10 text-xs text-gray-300">
              {publicImprintUrl && (
                <>
                  <a href={publicImprintUrl} target="_blank" rel="noreferrer">
                    Imprint
                  </a>
                </>
              )}
              {publicImprintUrl && publicPrivacyUrl && (
                <span className="px-2">|</span>
              )}
              {publicPrivacyUrl && (
                <a href={publicPrivacyUrl} target="_blank" rel="noreferrer">
                  Privacy Policy
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
