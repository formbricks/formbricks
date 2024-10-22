"use client";

import { Variants, motion } from "framer-motion";
import { useRef, useState } from "react";
import type { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyType } from "@formbricks/types/surveys/types";
import { ClientLogo } from "@formbricks/ui/components/ClientLogo";
import { MediaBackground } from "@formbricks/ui/components/MediaBackground";
import { Modal } from "@formbricks/ui/components/PreviewSurvey/components/Modal";
import { ResetProgressButton } from "@formbricks/ui/components/ResetProgressButton";
import { SurveyInline } from "@formbricks/ui/components/Survey";

interface ThemeStylingPreviewSurveyProps {
  survey: TSurvey;
  setQuestionId: (_: string) => void;
  product: TProduct;
  previewType: TSurveyType;
  setPreviewType: (type: TSurveyType) => void;
}

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

export const ThemeStylingPreviewSurvey = ({
  survey,
  product,
  previewType,
  setPreviewType,
  setQuestionId,
}: ThemeStylingPreviewSurveyProps) => {
  const [isFullScreenPreview] = useState(false);
  const [previewPosition] = useState("relative");
  const ContentRef = useRef<HTMLDivElement | null>(null);
  const [shrink] = useState(false);

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
  const { darkOverlay: surveyDarkOverlay } = productOverwrites || {};
  const { clickOutsideClose: surveyClickOutsideClose } = productOverwrites || {};

  const placement = surveyPlacement || product.placement;
  const darkOverlay = surveyDarkOverlay ?? product.darkOverlay;
  const clickOutsideClose = surveyClickOutsideClose ?? product.clickOutsideClose;

  const highlightBorderColor = product.styling.highlightBorderColor?.light;

  const resetQuestionProgress = () => {
    setQuestionId(survey?.questions[0]?.id);
  };

  const isAppSurvey = previewType === "app";

  const scrollToEditLogoSection = () => {
    const editLogoSection = document.getElementById("edit-logo");
    if (editLogoSection) {
      editLogoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-items-center overflow-hidden">
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
        className="relative flex h-[95%] max-h-[95%] w-5/6 items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
        <div className="flex h-full w-5/6 flex-1 flex-col">
          <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
            <div className="ml-6 flex space-x-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
              <p>{isAppSurvey ? "Your web app" : "Preview"}</p>

              <div className="flex items-center">
                <ResetProgressButton onClick={resetQuestionProgress} />
              </div>
            </div>
          </div>

          {isAppSurvey ? (
            <Modal
              isOpen
              placement={placement}
              clickOutsideClose={clickOutsideClose}
              darkOverlay={darkOverlay}
              previewMode="desktop"
              background={product.styling.cardBackgroundColor?.light}
              borderRadius={product.styling.roundness ?? 8}>
              <SurveyInline
                survey={{ ...survey, type: "app" }}
                isBrandingEnabled={product.inAppSurveyBranding}
                isRedirectDisabled={true}
                onFileUpload={async (file) => file.name}
                styling={product.styling}
                isCardBorderVisible={!highlightBorderColor}
                languageCode="default"
                getSetQuestionId={(f: (value: string) => void) => {
                  setQuestionId = f;
                }}
              />
            </Modal>
          ) : (
            <MediaBackground survey={survey} product={product} ContentRef={ContentRef} isEditorView>
              {!product.styling?.isLogoHidden && (
                <div className="absolute left-5 top-5" onClick={scrollToEditLogoSection}>
                  <ClientLogo product={product} previewSurvey />
                </div>
              )}
              <div
                className={`${product.logo?.url && !product.styling.isLogoHidden && !isFullScreenPreview ? "mt-12" : ""} z-0 w-full max-w-md rounded-lg p-4`}>
                <SurveyInline
                  survey={{ ...survey, type: "link" }}
                  isBrandingEnabled={product.linkSurveyBranding}
                  isRedirectDisabled={true}
                  onFileUpload={async (file) => file.name}
                  responseCount={42}
                  styling={product.styling}
                  languageCode="default"
                  getSetQuestionId={(f: (value: string) => void) => {
                    setQuestionId = f;
                  }}
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
          className={`${isAppSurvey ? "rounded-full bg-slate-200" : ""} cursor-pointer px-3 py-1 text-sm`}
          onClick={() => setPreviewType("app")}>
          App survey
        </div>
      </div>
    </div>
  );
};
