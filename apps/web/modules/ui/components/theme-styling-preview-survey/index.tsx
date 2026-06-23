"use client";

import { MotionConfig, Variants, motion } from "framer-motion";
import { Fragment, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLinkSurveyCardMaxWidth } from "@formbricks/types/styling";
import { TSurvey, TSurveyType } from "@formbricks/types/surveys/types";
import { TWorkspace } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { CardlessPreviewLogo } from "@/modules/ui/components/cardless-preview-logo";
import { ClientLogo } from "@/modules/ui/components/client-logo";
import { MediaBackground } from "@/modules/ui/components/media-background";
import { Modal } from "@/modules/ui/components/preview-survey/components/modal";
import { ResetProgressButton } from "@/modules/ui/components/reset-progress-button";
import { SurveyInline } from "@/modules/ui/components/survey";

interface ThemeStylingPreviewSurveyProps {
  survey: TSurvey;
  workspace: TWorkspace;
  previewType: TSurveyType;
  setPreviewType: (type: TSurveyType) => void;
  publicDomain: string;
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
  workspace,
  previewType,
  setPreviewType,
  publicDomain,
}: ThemeStylingPreviewSurveyProps) => {
  const [isFullScreenPreview] = useState(false);
  const [previewPosition] = useState("relative");
  const ContentRef = useRef<HTMLDivElement | null>(null);
  const [shrink] = useState(false);
  const { t } = useTranslation();
  const { workspaceOverwrites } = survey || {};
  const isAppSurvey = previewType === "app"; // Moved up

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
      width: ["83.33%"],
      height: ["700px"],
    },
  };

  const { placement: surveyPlacement } = workspaceOverwrites || {};
  const { overlay: surveyOverlay } = workspaceOverwrites || {};
  const { clickOutsideClose: surveyClickOutsideClose } = workspaceOverwrites || {};

  const placement = surveyPlacement || workspace.placement;
  const overlay = surveyOverlay ?? workspace.overlay;
  const clickOutsideClose = surveyClickOutsideClose ?? workspace.clickOutsideClose;

  const highlightBorderColor = workspace.styling.highlightBorderColor?.light;
  const [surveyFormKey, setSurveyFormKey] = useState<number>(Date.now());

  const resetQuestionProgress = () => {
    setSurveyFormKey(Date.now());
  };

  const styling = useMemo(() => {
    if (survey.styling?.overwriteThemeStyling) {
      return { ...workspace.styling, ...survey.styling };
    }
    return workspace.styling;
  }, [workspace.styling, survey.styling]);

  const isCardless = styling.cardArrangement?.linkSurveys === "cardless";
  const linkSurveyCardMaxWidth = getLinkSurveyCardMaxWidth(styling.linkSurveyCardWidth);

  // Create a unique key that includes both timestamp and preview type
  // This ensures the survey remounts when switching between app and link
  const surveyKey = `${previewType}-${surveyFormKey}`;

  const scrollToEditLogoSection = () => {
    const editLogoSection = document.getElementById("edit-logo");
    if (editLogoSection) {
      editLogoSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Cardless surveys span the full width; card-based surveys are capped to the configured width.
  const cardMaxWidthStyle = isCardless ? undefined : { maxWidth: linkSurveyCardMaxWidth };
  const linkPreviewLogoOffsetClass = !workspace.styling.isLogoHidden && !isFullScreenPreview ? "mt-12" : "";

  const renderAppPreview = () => (
    <Modal
      isOpen
      placement={placement}
      clickOutsideClose={clickOutsideClose}
      overlay={overlay}
      previewMode="desktop"
      background={workspace.styling.cardBackgroundColor?.light}
      borderRadius={workspace.styling.roundness ?? 8}>
      <Fragment key={surveyKey}>
        <SurveyInline
          appUrl={publicDomain}
          isPreviewMode={true}
          survey={toJsWorkspaceStateSurvey({ ...survey, type: "app" })}
          isBrandingEnabled={workspace.inAppSurveyBranding}
          isRedirectDisabled={true}
          onFileUpload={async (file) => file.name}
          styling={styling}
          isCardBorderVisible={!highlightBorderColor}
          languageCode="default"
        />
      </Fragment>
    </Modal>
  );

  const renderLinkPreview = () => (
    <MediaBackground
      surveyType={survey.type}
      styling={styling}
      ContentRef={ContentRef as React.MutableRefObject<HTMLDivElement> | null}
      isEditorView
      useNaturalHeight={isCardless}>
      <div
        className={cn(
          "flex w-full justify-center",
          isCardless ? "h-full min-h-0 flex-1 flex-col items-stretch overflow-hidden" : "h-full items-center"
        )}>
        {!workspace.styling?.isLogoHidden && !isCardless && (
          <button type="button" className="absolute left-5 top-5" onClick={scrollToEditLogoSection}>
            <ClientLogo
              workspaceLogo={workspace.logo ?? null}
              workspaceId={workspace.id}
              previewSurvey
              disableLinks
            />
          </button>
        )}
        <div
          className={cn(
            "w-full",
            isCardless
              ? "flex min-h-0 w-full flex-1 flex-col"
              : cn(linkPreviewLogoOffsetClass, "z-0 mx-auto overflow-hidden rounded-lg p-4")
          )}
          style={cardMaxWidthStyle}>
          <div
            key={surveyKey}
            className={cn("flex min-h-0 w-full flex-1 flex-col", !isCardless && "justify-center")}>
            <SurveyInline
              appUrl={publicDomain}
              isPreviewMode={true}
              survey={toJsWorkspaceStateSurvey({ ...survey, type: "link" })}
              isBrandingEnabled={workspace.linkSurveyBranding}
              isRedirectDisabled={true}
              onFileUpload={async (file) => file.name}
              responseCount={42}
              styling={styling}
              showCardlessPreviewLogoSlot={!workspace.styling?.isLogoHidden}
              languageCode="default"
            />
          </div>
        </div>
      </div>
    </MediaBackground>
  );

  return (
    <MotionConfig reducedMotion="user">
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
          className={cn(
            "relative z-10 flex w-5/6 flex-col rounded-lg border border-slate-300 shadow-xl",
            isAppSurvey ? "bg-slate-200" : "overflow-y-auto bg-white"
          )}>
          <div className="flex h-auto w-full items-center rounded-t-lg bg-slate-100 py-2">
            <div className="ml-6 flex gap-x-2">
              <div className="size-3 rounded-full bg-red-500"></div>
              <div className="size-3 rounded-full bg-amber-500"></div>
              <div className="size-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
              <p>{isAppSurvey ? t("workspace.surveys.edit.your_web_app") : t("common.preview")}</p>

              <div className="flex items-center">
                <ResetProgressButton onClick={resetQuestionProgress} />
              </div>
            </div>
          </div>
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-b-lg">
            {isAppSurvey ? renderAppPreview() : renderLinkPreview()}
          </div>
        </motion.div>

        {isCardless && !workspace.styling?.isLogoHidden && (
          <CardlessPreviewLogo
            workspaceLogo={workspace.logo ?? null}
            workspaceId={workspace.id}
            mountKey={surveyKey}
            onLogoClick={scrollToEditLogoSection}
          />
        )}

        {/* for toggling between mobile and desktop mode  */}
        <div className="mt-2 flex rounded-full border-2 border-slate-300 p-1">
          <button
            type="button"
            className={`${previewType === "link" ? "rounded-full bg-slate-200" : ""} cursor-pointer px-3 py-1 text-sm`}
            onClick={() => setPreviewType("link")}>
            {t("common.link_survey")}
          </button>

          <button
            type="button"
            className={`${isAppSurvey ? "rounded-full bg-slate-200" : ""} cursor-pointer px-3 py-1 text-sm`}
            onClick={() => setPreviewType("app")}>
            {t("common.app_survey")}
          </button>
        </div>
      </div>
    </MotionConfig>
  );
};
