"use client";

import { ClientLogo } from "@/modules/ui/components/client-logo";
import { MediaBackground } from "@/modules/ui/components/media-background";
import { ResetProgressButton } from "@/modules/ui/components/reset-progress-button";
import { SurveyInline } from "@/modules/ui/components/survey";
import { Environment, Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { Variants, motion } from "framer-motion";
import { ExpandIcon, MonitorIcon, ShrinkIcon, SmartphoneIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyQuestionId, TSurveyStyling } from "@formbricks/types/surveys/types";
import { Modal } from "./components/modal";
import { TabOption } from "./components/tab-option";

type TPreviewType = "modal" | "fullwidth" | "email";

interface PreviewSurveyProps {
  survey: TSurvey;
  questionId?: string | null;
  previewType?: TPreviewType;
  project: Project;
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  languageCode: string;
}

let surveyNameTemp: string;

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

let setQuestionId = (_: string) => {};

export const PreviewSurvey = ({
  questionId,
  survey,
  previewType,
  project,
  environment,
  languageCode,
}: PreviewSurveyProps) => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const { t } = useTranslate();
  const [appSetupCompleted, setAppSetupCompleted] = useState(false);

  const [previewMode, setPreviewMode] = useState("desktop");
  const [previewPosition, setPreviewPosition] = useState("relative");
  const ContentRef = useRef<HTMLDivElement | null>(null);
  const [shrink, setShrink] = useState(false);
  const { projectOverwrites } = survey || {};
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
      width: ["95%"],
      height: ["95%"],
    },
  };

  const { placement: surveyPlacement } = projectOverwrites || {};
  const { darkOverlay: surveyDarkOverlay } = projectOverwrites || {};
  const { clickOutsideClose: surveyClickOutsideClose } = projectOverwrites || {};

  const placement = surveyPlacement || project.placement;
  const darkOverlay = surveyDarkOverlay ?? project.darkOverlay;
  const clickOutsideClose = surveyClickOutsideClose ?? project.clickOutsideClose;

  const widgetSetupCompleted = appSetupCompleted;

  const styling: TSurveyStyling | TProjectStyling = useMemo(() => {
    // allow style overwrite is disabled from the project
    if (!project.styling.allowStyleOverwrite) {
      return project.styling;
    }

    // allow style overwrite is enabled from the project
    if (project.styling.allowStyleOverwrite) {
      // survey style overwrite is disabled
      if (!survey.styling?.overwriteThemeStyling) {
        return project.styling;
      }

      // survey style overwrite is enabled
      return survey.styling;
    }

    return project.styling;
  }, [project.styling, survey.styling]);

  const updateQuestionId = useCallback(
    (newQuestionId: TSurveyQuestionId) => {
      if (
        !newQuestionId ||
        newQuestionId === "hidden" ||
        newQuestionId === "multiLanguage" ||
        newQuestionId.includes("fb-variables-")
      )
        return;
      if (newQuestionId === "start" && !survey.welcomeCard.enabled) return;
      setQuestionId(newQuestionId);
    },
    [survey.welcomeCard.enabled]
  );

  useEffect(() => {
    if (questionId) {
      updateQuestionId(questionId);
    }
  }, [questionId, updateQuestionId]);

  const onFinished = () => {
    // close modal if there are no questions left
    if (survey.type === "app" && survey.endings.length === 0) {
      setIsModalOpen(false);
      setTimeout(() => {
        setQuestionId(survey.questions[0]?.id);
        setIsModalOpen(true);
      }, 500);
    }
  };

  // this useEffect is for refreshing the survey preview only if user is switching between templates on survey templates page and hence we are checking for survey.id === "someUniqeId1" which is a common Id for all templates
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

    setQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id);
  };

  useEffect(() => {
    if (environment) {
      setAppSetupCompleted(environment.appSetupCompleted);
    }
  }, [environment]);

  const handlePreviewModalClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setIsModalOpen(true);
      resetQuestionProgress();
    }, 1000);
  };

  if (!previewType) {
    previewType = widgetSetupCompleted ? "modal" : "fullwidth";

    if (!questionId) {
      return <></>;
    }
  }

  const handlePreviewModeChange = (mode: "mobile" | "desktop") => {
    setPreviewMode(mode);
    requestAnimationFrame(() => {
      if (questionId) {
        setQuestionId(questionId);
      }
    });
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-items-center py-4" id="survey-preview">
      <motion.div
        variants={previewParentContainerVariant}
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
        className="relative flex h-full w-[95%] items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
        {previewMode === "mobile" && (
          <>
            <p className="absolute top-0 left-0 m-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-400">
              Preview
            </p>
            <div className="absolute top-0 right-0 m-2">
              <ResetProgressButton onClick={resetQuestionProgress} />
            </div>
            <MediaBackground
              surveyType={survey.type}
              styling={styling}
              ContentRef={ContentRef as React.RefObject<HTMLDivElement>}
              isMobilePreview>
              {previewType === "modal" ? (
                <Modal
                  isOpen={isModalOpen}
                  placement={placement}
                  previewMode="mobile"
                  darkOverlay={darkOverlay}
                  clickOutsideClose={clickOutsideClose}
                  borderRadius={styling?.roundness ?? 8}
                  background={styling?.cardBackgroundColor?.light}>
                  <SurveyInline
                    isPreviewMode={true}
                    survey={survey}
                    isBrandingEnabled={project.inAppSurveyBranding}
                    isRedirectDisabled={true}
                    languageCode={languageCode}
                    styling={styling}
                    isCardBorderVisible={!styling.highlightBorderColor?.light}
                    onClose={handlePreviewModalClose}
                    getSetQuestionId={(f: (value: string) => void) => {
                      setQuestionId = f;
                    }}
                    onFinished={onFinished}
                    isSpamProtectionEnabled={survey.recaptcha?.enabled}
                  />
                </Modal>
              ) : (
                <div className="flex h-full w-full flex-col justify-center px-1">
                  <div className="absolute top-5 left-5">
                    {!styling.isLogoHidden && (
                      <ClientLogo environmentId={environment.id} projectLogo={project.logo} previewSurvey />
                    )}
                  </div>
                  <div className="z-10 w-full max-w-md rounded-lg border border-transparent">
                    <SurveyInline
                      isPreviewMode={true}
                      survey={{ ...survey, type: "link" }}
                      isBrandingEnabled={project.linkSurveyBranding}
                      languageCode={languageCode}
                      responseCount={42}
                      styling={styling}
                      getSetQuestionId={(f: (value: string) => void) => {
                        setQuestionId = f;
                      }}
                      isSpamProtectionEnabled={survey.recaptcha?.enabled}
                    />
                  </div>
                </div>
              )}
            </MediaBackground>
          </>
        )}
        {previewMode === "desktop" && (
          <div className="flex h-full flex-1 flex-col">
            <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
              <div className="ml-6 flex space-x-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                <button
                  className="h-3 w-3 cursor-pointer rounded-full bg-emerald-500"
                  onClick={() => {
                    if (isFullScreenPreview) {
                      setShrink(true);
                      setPreviewPosition("relative");
                      setTimeout(() => setIsFullScreenPreview(false), 300);
                    } else {
                      setShrink(false);
                      setIsFullScreenPreview(true);
                      setTimeout(() => setPreviewPosition("fixed"), 300);
                    }
                  }}
                  aria-label={isFullScreenPreview ? "Shrink Preview" : "Expand Preview"}></button>
              </div>
              <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                <p>
                  {previewType === "modal"
                    ? t("environments.surveys.edit.your_web_app")
                    : t("common.preview")}
                </p>

                <div className="flex items-center">
                  {isFullScreenPreview ? (
                    <ShrinkIcon
                      className="mr-1 h-[22px] w-[22px] cursor-pointer rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
                      onClick={() => {
                        setShrink(true);
                        setPreviewPosition("relative");
                        setTimeout(() => setIsFullScreenPreview(false), 300);
                      }}
                    />
                  ) : (
                    <ExpandIcon
                      className="mr-1 h-[22px] w-[22px] cursor-pointer rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
                      onClick={() => {
                        setShrink(false);
                        setIsFullScreenPreview(true);
                        setTimeout(() => setPreviewPosition("fixed"), 300);
                      }}
                    />
                  )}
                  <ResetProgressButton onClick={resetQuestionProgress} />
                </div>
              </div>
            </div>

            {previewType === "modal" ? (
              <Modal
                isOpen={isModalOpen}
                placement={placement}
                clickOutsideClose={clickOutsideClose}
                darkOverlay={darkOverlay}
                previewMode="desktop"
                borderRadius={styling.roundness ?? 8}
                background={styling.cardBackgroundColor?.light}>
                <SurveyInline
                  isPreviewMode={true}
                  survey={survey}
                  isBrandingEnabled={project.inAppSurveyBranding}
                  isRedirectDisabled={true}
                  languageCode={languageCode}
                  styling={styling}
                  isCardBorderVisible={!styling.highlightBorderColor?.light}
                  onClose={handlePreviewModalClose}
                  getSetQuestionId={(f: (value: string) => void) => {
                    setQuestionId = f;
                  }}
                  onFinished={onFinished}
                  isSpamProtectionEnabled={survey.recaptcha?.enabled}
                />
              </Modal>
            ) : (
              <MediaBackground
                surveyType={survey.type}
                styling={styling}
                ContentRef={ContentRef as React.RefObject<HTMLDivElement>}
                isEditorView>
                <div className="absolute top-5 left-5">
                  {!styling.isLogoHidden && (
                    <ClientLogo environmentId={environment.id} projectLogo={project.logo} previewSurvey />
                  )}
                </div>
                <div className="z-0 w-full max-w-4xl rounded-lg border-transparent">
                  <SurveyInline
                    isPreviewMode={true}
                    survey={{ ...survey, type: "link" }}
                    isBrandingEnabled={project.linkSurveyBranding}
                    isRedirectDisabled={true}
                    languageCode={languageCode}
                    responseCount={42}
                    styling={styling}
                    getSetQuestionId={(f: (value: string) => void) => {
                      setQuestionId = f;
                    }}
                    isSpamProtectionEnabled={survey.recaptcha?.enabled}
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
          onClick={() => handlePreviewModeChange("mobile")}
        />
        <TabOption
          active={previewMode === "desktop"}
          icon={<MonitorIcon className="mx-4 my-2 h-4 w-4 text-slate-700" />}
          onClick={() => handlePreviewModeChange("desktop")}
        />
      </div>
    </div>
  );
};

export { getPlacementStyle } from "./lib/utils";
