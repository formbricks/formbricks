"use client";

import Modal from "@/app/(app)/environments/[environmentId]/surveys/components/Modal";
import TabOption from "@/app/(app)/environments/[environmentId]/surveys/components/TabOption";
import { MediaBackground } from "@/app/s/[surveyId]/components/MediaBackground";
import { Variants, motion } from "framer-motion";
import { ExpandIcon, MonitorIcon, ShrinkIcon, SmartphoneIcon } from "lucide-react";
import { RefreshCcwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { TEnvironment } from "@formbricks/types/environment";
import type { TProduct } from "@formbricks/types/product";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { SurveyInline } from "@formbricks/ui/Survey";

type TPreviewType = "modal" | "fullwidth" | "email";

interface PreviewSurveyProps {
  survey: TSurvey;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  previewType?: TPreviewType;
  product: TProduct;
  environment: TEnvironment;
  onFileUpload: (file: File, config?: TUploadFileConfig) => Promise<string>;
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
    zIndex: -1,
  },
};
export default function PreviewSurvey({
  setActiveQuestionId,
  activeQuestionId,
  survey,
  previewType,
  product,
  environment,
  onFileUpload,
}: PreviewSurveyProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [previewPosition, setPreviewPosition] = useState("relative");
  const ContentRef = useRef<HTMLDivElement | null>(null);
  const [shrink, setShrink] = useState(false);
  const { productOverwrites } = survey || {};

  const previewScreenVariants: Variants = {
    expanded: {
      right: "5%",
      bottom: "10%",
      top: "12%",
      width: "40%",
      position: "fixed",
      height: "80%",
      zIndex: 1050,
      boxShadow: "0px 4px 5px 4px rgba(169, 169, 169, 0.25)",
      transition: {
        ease: "easeInOut",
        duration: shrink ? 0.3 : 0,
      },
    },
    expanded_with_fixed_positioning: {
      zIndex: 1050,
      position: "fixed",
      top: "5%",
      right: "5%",
      bottom: "10%",
      width: "90%",
      height: "90%",
      transition: {
        ease: "easeOut",
        duration: 0.4,
      },
    },
    shrink: {
      display: "relative",
      width: ["83.33%"],
      height: ["95%"],
    },
  };

  const {
    brandColor: surveyBrandColor,
    highlightBorderColor: surveyHighlightBorderColor,
    placement: surveyPlacement,
  } = productOverwrites || {};

  const brandColor = surveyBrandColor || product.brandColor;
  const placement = surveyPlacement || product.placement;
  const highlightBorderColor = surveyHighlightBorderColor || product.highlightBorderColor;

  useEffect(() => {
    // close modal if there are no questions left
    if (survey.type === "web" && !survey.thankYouCard.enabled) {
      if (activeQuestionId === "end") {
        setIsModalOpen(false);
        setTimeout(() => {
          setActiveQuestionId(survey.questions[0]?.id);
          setIsModalOpen(true);
        }, 500);
      }
    }
  }, [activeQuestionId, survey.type, survey, setActiveQuestionId]);

  // this useEffect is fo refreshing the survey preview only if user is switching between templates on survey templates page and hence we are checking for survey.id === "someUniqeId1" which is a common Id for all templates
  useEffect(() => {
    if (survey.name !== surveyNameTemp && survey.id === "someUniqueId1") {
      resetQuestionProgress();
      surveyNameTemp = survey.name;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey]);

  const resetQuestionProgress = () => {
    let storePreviewMode = previewMode;
    setPreviewMode("null");
    setTimeout(() => {
      setPreviewMode(storePreviewMode);
    }, 10);

    setActiveQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id);
  };

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  const handlePreviewModalClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 1000);
  };

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
        layout
        variants={previewScreenVariants}
        animate={
          isFullScreenPreview
            ? previewPosition === "relative"
              ? "expanded"
              : "expanded_with_fixed_positioning"
            : "shrink"
        }
        className="relative flex h-[95] max-h-[95%] w-5/6 items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
        {previewMode === "mobile" && (
          <>
            <p className="absolute left-0 top-0 m-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-400">
              Preview
            </p>
            <div className="absolute right-0 top-0 m-2">
              <ResetProgressButton resetQuestionProgress={resetQuestionProgress} />
            </div>
            <MediaBackground survey={survey} ContentRef={ContentRef} isMobilePreview>
              {previewType === "modal" ? (
                <Modal
                  isOpen={isModalOpen}
                  placement={placement}
                  highlightBorderColor={highlightBorderColor}
                  previewMode="mobile">
                  <SurveyInline
                    survey={survey}
                    brandColor={brandColor}
                    activeQuestionId={activeQuestionId || undefined}
                    isBrandingEnabled={product.inAppSurveyBranding}
                    onActiveQuestionChange={setActiveQuestionId}
                    isRedirectDisabled={true}
                    onFileUpload={onFileUpload}
                    onClose={handlePreviewModalClose}
                  />
                </Modal>
              ) : (
                <div className="w-full px-3">
                  <div className="no-scrollbar z-10 w-full max-w-md overflow-y-auto rounded-lg border border-transparent">
                    <SurveyInline
                      survey={survey}
                      brandColor={brandColor}
                      activeQuestionId={activeQuestionId || undefined}
                      isBrandingEnabled={product.linkSurveyBranding}
                      onActiveQuestionChange={setActiveQuestionId}
                      onFileUpload={onFileUpload}
                      responseCount={42}
                    />
                  </div>
                </div>
              )}
            </MediaBackground>
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
              <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                <p>{previewType === "modal" ? "Your web app" : "Preview"}</p>

                <div className="flex items-center">
                  {isFullScreenPreview ? (
                    <ShrinkIcon
                      className="mr-2 h-4 w-4 cursor-pointer"
                      onClick={() => {
                        setShrink(true);
                        setPreviewPosition("relative");
                        setTimeout(() => setIsFullScreenPreview(false), 300);
                      }}
                    />
                  ) : (
                    <ExpandIcon
                      className="mr-2 h-4 w-4 cursor-pointer"
                      onClick={() => {
                        setShrink(false);
                        setIsFullScreenPreview(true);
                        setTimeout(() => setPreviewPosition("fixed"), 300);
                      }}
                    />
                  )}
                  <ResetProgressButton resetQuestionProgress={resetQuestionProgress} />
                </div>
              </div>
            </div>

            {previewType === "modal" ? (
              <Modal
                isOpen={isModalOpen}
                placement={placement}
                highlightBorderColor={highlightBorderColor}
                previewMode="desktop">
                <SurveyInline
                  survey={survey}
                  brandColor={brandColor}
                  activeQuestionId={activeQuestionId || undefined}
                  isBrandingEnabled={product.inAppSurveyBranding}
                  onActiveQuestionChange={setActiveQuestionId}
                  isRedirectDisabled={true}
                  onFileUpload={onFileUpload}
                  onClose={handlePreviewModalClose}
                />
              </Modal>
            ) : (
              <MediaBackground survey={survey} ContentRef={ContentRef} isEditorView>
                <div className="z-0 w-full max-w-md rounded-lg p-4">
                  <SurveyInline
                    survey={survey}
                    brandColor={brandColor}
                    activeQuestionId={activeQuestionId || undefined}
                    isBrandingEnabled={product.linkSurveyBranding}
                    onActiveQuestionChange={setActiveQuestionId}
                    isRedirectDisabled={true}
                    onFileUpload={onFileUpload}
                    responseCount={42}
                  />
                </div>
              </MediaBackground>
            )}
          </div>
        )}
      </motion.div>

      {/* for toggling between mobile and desktop mode  */}
      <div className="mt-2 flex rounded-full border-2 border-slate-300 p-1">
        <TabOption
          active={previewMode === "mobile"}
          icon={<SmartphoneIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
          onClick={() => setPreviewMode("mobile")}
        />
        <TabOption
          active={previewMode === "desktop"}
          icon={<MonitorIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
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
      <RefreshCcwIcon className="ml-2 h-4 w-4" />
    </Button>
  );
}
