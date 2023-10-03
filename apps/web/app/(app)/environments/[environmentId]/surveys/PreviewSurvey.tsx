"use client";
import Modal from "@/components/preview/Modal";
import TabOption from "@/components/preview/TabOption";
import { SurveyInline } from "@/components/shared/Survey";
import { Survey } from "@formbricks/types/surveys";
import type { TEnvironment } from "@formbricks/types/v1/environment";
import type { TProduct } from "@formbricks/types/v1/product";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui";
import { ArrowPathRoundedSquareIcon } from "@heroicons/react/24/outline";
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/solid";
import { Variants, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface PreviewSurveyProps {
  survey: TSurvey | Survey;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  previewType?: "modal" | "fullwidth" | "email";
  product: TProduct;
  environment: TEnvironment;
}
let surveyNameTemp;

const previewParentContainerVariant: Variants = {
  expanded: {
    position: "fixed",
    height: "100%",
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(15px)",
    left: 0,
    top: 0,
    zIndex: 1040,
    transition: {
      ease: "easeIn",
      duration: 0.001,
    },
  },
  shrink: {
    display: "none",
    position: "fixed",
    backgroundColor: "rgba(0, 0, 0, 0.0)",
    backdropFilter: "blur(0px)",
    transition: {
      duration: 0,
    },
  },
};

const previewScreenVariants: Variants = {
  expanded: {
    position: "fixed",
    width: "90vw",
    height: "90vh",
    right: "5%",
    bottom: "5%",
    zIndex: 1050,
    boxShadow: "0px 4px 5px 4px rgba(169, 169, 169, 0.25)",
    transition: {
      ease: "easeInOut",
      duration: 0.3,
    },
    float: "right",
  },
  shrink: {
    display: "relative",
    width: ["90%"],
    height: ["100%"],
    transition: {
      duration: 1,
    },
  },
};

export default function PreviewSurvey({
  survey,
  setActiveQuestionId,
  activeQuestionId,
  previewType,
  product,
  environment,
}: PreviewSurveyProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [previewMode, setPreviewMode] = useState("desktop");
  const ContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // close modal if there are no questions left
    if (survey.type === "web" && !survey.thankYouCard.enabled) {
      if (activeQuestionId === "thank-you-card") {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(survey.questions[0].id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [activeQuestionId, survey.type, survey, setActiveQuestionId]);

  useEffect(() => {
    if (survey.name !== surveyNameTemp) {
      resetQuestionProgress();
      surveyNameTemp = survey.name;
    }
  }, [survey]);

  function resetQuestionProgress() {
    let storePreviewMode = previewMode;
    setPreviewMode("null");
    setTimeout(() => {
      setPreviewMode(storePreviewMode);
    }, 10);

    setActiveQuestionId(survey.questions[0].id);
  }

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  if (!previewType) {
    previewType = widgetSetupCompleted ? "modal" : "fullwidth";

    if (!activeQuestionId) {
      return <></>;
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-items-center">
      <motion.div
        variants={previewParentContainerVariant}
        className="fixed hidden h-[95%] w-5/6"
        animate={isFullScreenPreview ? "expanded" : "shrink"}
      />
      <motion.div
        variants={previewScreenVariants}
        animate={isFullScreenPreview ? "expanded" : "shrink"}
        className="relative flex w-5/6 items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
        {previewMode === "mobile" && (
          <>
            <div className="absolute right-0 top-0 m-2">
              <ResetProgressButton resetQuestionProgress={resetQuestionProgress} />
            </div>
            <div className="relative h-[90%] max-h-[40rem] w-80 overflow-hidden rounded-[3rem] border-8 border-slate-500 bg-slate-400">
              {/* below element is use to create notch for the mobile device mockup   */}
              <div className="absolute left-1/2 right-1/2 top-0 z-20 h-4 w-1/2 -translate-x-1/2 transform rounded-b-md bg-slate-500"></div>
              {previewType === "modal" ? (
                <Modal
                  isOpen={isModalOpen}
                  placement={product.placement}
                  highlightBorderColor={product.highlightBorderColor}
                  previewMode="mobile">
                  <SurveyInline
                    survey={survey}
                    brandColor={product.brandColor}
                    activeQuestionId={activeQuestionId || undefined}
                    formbricksSignature={product.formbricksSignature}
                    onActiveQuestionChange={setActiveQuestionId}
                    isRedirectDisabled={true}
                  />
                </Modal>
              ) : (
                <div
                  className="absolute top-0 z-10 flex h-full w-full flex-grow flex-col overflow-y-auto"
                  ref={ContentRef}>
                  <div className="flex w-full flex-grow flex-col items-center justify-center bg-white py-6">
                    <div className="w-full max-w-md px-4">
                      <SurveyInline
                        survey={survey}
                        brandColor={product.brandColor}
                        activeQuestionId={activeQuestionId || undefined}
                        formbricksSignature={product.formbricksSignature}
                        onActiveQuestionChange={setActiveQuestionId}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {previewMode === "desktop" && (
          <div className="flex h-full w-5/6 flex-1 flex-col">
            <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
              <div className="ml-6 flex space-x-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              </div>
              <p className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                {previewType === "modal" ? "Your web app" : "Preview"}
                <div className="flex items-center">
                  {isFullScreenPreview ? (
                    <ArrowsPointingInIcon
                      className="mr-2 h-4 w-4 cursor-pointer"
                      onClick={() => setIsFullScreenPreview(false)}
                    />
                  ) : (
                    <ArrowsPointingOutIcon
                      className="mr-2 h-4 w-4 cursor-pointer"
                      onClick={() => setIsFullScreenPreview(true)}
                    />
                  )}
                  <ResetProgressButton resetQuestionProgress={resetQuestionProgress} />
                </div>
              </p>
            </div>

            {previewType === "modal" ? (
              <Modal
                isOpen={isModalOpen}
                placement={product.placement}
                highlightBorderColor={product.highlightBorderColor}
                previewMode="desktop">
                <SurveyInline
                  survey={survey}
                  brandColor={product.brandColor}
                  activeQuestionId={activeQuestionId || undefined}
                  formbricksSignature={product.formbricksSignature}
                  onActiveQuestionChange={setActiveQuestionId}
                  isRedirectDisabled={true}
                />
              </Modal>
            ) : (
              <div className="flex flex-grow flex-col overflow-y-auto rounded-b-lg" ref={ContentRef}>
                <div className="flex w-full flex-grow flex-col items-center justify-center bg-white p-4 py-6">
                  <div className="w-full max-w-md">
                    <SurveyInline
                      survey={survey}
                      brandColor={product.brandColor}
                      activeQuestionId={activeQuestionId || undefined}
                      formbricksSignature={product.formbricksSignature}
                      onActiveQuestionChange={setActiveQuestionId}
                      isRedirectDisabled={true}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* for toggling between mobile and desktop mode  */}
      <div className="mt-2 flex rounded-full border-2 border-slate-300 p-1">
        <TabOption
          active={previewMode === "mobile"}
          icon={<DevicePhoneMobileIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
          onClick={() => setPreviewMode("mobile")}
        />
        <TabOption
          active={previewMode === "desktop"}
          icon={<ComputerDesktopIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
          onClick={() => setPreviewMode("desktop")}
        />
      </div>
    </div>
  );
}

function ResetProgressButton({ resetQuestionProgress }) {
  return (
    <Button
      variant="minimal"
      className="py-0.2 mr-2 bg-white px-2 font-sans text-sm text-slate-500"
      onClick={resetQuestionProgress}>
      Restart
      <ArrowPathRoundedSquareIcon className="ml-2 h-4 w-4" />
    </Button>
  );
}
