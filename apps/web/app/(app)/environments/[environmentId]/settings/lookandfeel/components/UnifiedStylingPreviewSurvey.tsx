"use client";

import Modal from "@/app/(app)/environments/[environmentId]/surveys/components/Modal";
import { MediaBackground } from "@/app/s/[surveyId]/components/MediaBackground";
import { ArrowPathRoundedSquareIcon } from "@heroicons/react/24/outline";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/solid";
import { Variants, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { SurveyInline } from "@formbricks/ui/Survey";

interface UnifiedStylingPreviewSurveyProps {
  survey: TSurvey;
  setActiveQuestionId: (id: string | null) => void;
  activeQuestionId?: string | null;
  product: TProduct;
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

export const UnifiedStylingPreviewSurvey = ({
  setActiveQuestionId,
  activeQuestionId,
  survey,
  product,
}: UnifiedStylingPreviewSurveyProps) => {
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState("relative");
  const ContentRef = useRef<HTMLDivElement | null>(null);
  const [shrink, setshrink] = useState(false);

  const [previewType, setPreviewType] = useState<"link" | "web">("link");

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

  const { placement: surveyPlacement } = productOverwrites || {};

  const placement = surveyPlacement || product.placement;

  const highlightBorderColor = product.styling.highlightBorderColor?.light;

  // this useEffect is fo refreshing the survey preview only if user is switching between templates on survey templates page and hence we are checking for survey.id === "someUniqeId1" which is a common Id for all templates
  useEffect(() => {
    if (survey.name !== surveyNameTemp && survey.id === "someUniqueId1") {
      resetQuestionProgress();
      surveyNameTemp = survey.name;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey]);

  function resetQuestionProgress() {
    setActiveQuestionId(survey?.questions[0]?.id);
  }

  const onFileUpload = async (file: File) => file.name;

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
        <div className="flex h-full w-5/6 flex-1 flex-col">
          <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
            <div className="ml-6 flex space-x-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
              <p>{previewType === "web" ? "Your web app" : "Preview"}</p>

              <div className="flex items-center">
                {isFullScreenPreview ? (
                  <ArrowsPointingInIcon
                    className="mr-2 h-4 w-4 cursor-pointer"
                    onClick={() => {
                      setshrink(true);
                      setPreviewPosition("relative");
                      setTimeout(() => setIsFullScreenPreview(false), 300);
                    }}
                  />
                ) : (
                  <ArrowsPointingOutIcon
                    className="mr-2 h-4 w-4 cursor-pointer"
                    onClick={() => {
                      setshrink(false);
                      setIsFullScreenPreview(true);
                      setTimeout(() => setPreviewPosition("fixed"), 300);
                    }}
                  />
                )}
                <ResetProgressButton resetQuestionProgress={resetQuestionProgress} />
              </div>
            </div>
          </div>

          {previewType === "web" ? (
            <Modal
              isOpen
              placement={placement}
              highlightBorderColor={highlightBorderColor}
              previewMode="desktop"
              background={product.styling.cardBackgroundColor?.light}
              borderRadius={product.styling.roundness ?? 8}>
              <SurveyInline
                survey={survey}
                activeQuestionId={activeQuestionId || undefined}
                isBrandingEnabled={product.inAppSurveyBranding}
                onActiveQuestionChange={setActiveQuestionId}
                isRedirectDisabled={true}
                onFileUpload={onFileUpload}
                styling={product.styling}
                isCardBorderVisible={!highlightBorderColor}
              />
            </Modal>
          ) : (
            <MediaBackground survey={survey} ContentRef={ContentRef} isEditorView>
              <div className="z-0 w-full max-w-md rounded-lg p-4">
                <SurveyInline
                  survey={survey}
                  activeQuestionId={activeQuestionId || undefined}
                  isBrandingEnabled={product.linkSurveyBranding}
                  onActiveQuestionChange={setActiveQuestionId}
                  isRedirectDisabled={true}
                  onFileUpload={onFileUpload}
                  responseCount={42}
                  styling={product.styling}
                />
              </div>
            </MediaBackground>
          )}
        </div>
      </motion.div>

      {/* for toggling between mobile and desktop mode  */}
      <div className="mt-2 flex rounded-full border-2 border-slate-300 p-1">
        <div
          className={`${previewType === "link" ? "rounded-full bg-slate-200" : ""} cursor-pointer px-3 py-1 text-sm`}
          onClick={() => setPreviewType("link")}>
          Link survey
        </div>

        <div
          className={`${previewType === "web" ? "rounded-full bg-slate-200" : ""} cursor-pointer px-3 py-1 text-sm`}
          onClick={() => setPreviewType("web")}>
          App survey
        </div>
      </div>
    </div>
  );
};

const ResetProgressButton = ({ resetQuestionProgress }: { resetQuestionProgress: () => void }) => {
  return (
    <Button
      variant="minimal"
      className="py-0.2 mr-2 bg-white px-2 font-sans text-sm text-slate-500"
      onClick={resetQuestionProgress}>
      Restart
      <ArrowPathRoundedSquareIcon className="ml-2 h-4 w-4" />
    </Button>
  );
};
