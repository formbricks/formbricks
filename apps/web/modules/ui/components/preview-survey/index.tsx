"use client";

import { Environment, Project } from "@prisma/client";
import { motion } from "framer-motion";
import { ExpandIcon, GlobeIcon, MonitorIcon, ShrinkIcon, SmartphoneIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyLanguage, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { toJsEnvironmentStateSurvey } from "@/lib/survey/client-utils";
import { ClientLogo } from "@/modules/ui/components/client-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { MediaBackground } from "@/modules/ui/components/media-background";
import { ResetProgressButton } from "@/modules/ui/components/reset-progress-button";
import { SurveyInline } from "@/modules/ui/components/survey";
import { Modal } from "./components/modal";
import { TabOption } from "./components/tab-option";

type TPreviewType = "modal" | "fullwidth" | "email";

interface PreviewSurveyProps {
  survey: TSurvey;
  elementId?: string | null;
  previewType?: TPreviewType;
  project: Project;
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  languageCode: string;
  setLanguageCode?: (code: string) => void;
  locale?: TUserLocale;
  isSpamProtectionAllowed: boolean;
  publicDomain: string;
}

let surveyNameTemp: string;
let setBlockId = (_: string) => {};

export const PreviewSurvey = ({
  elementId,
  survey,
  previewType,
  project,
  environment,
  languageCode,
  setLanguageCode,
  locale,
  isSpamProtectionAllowed,
  publicDomain,
}: PreviewSurveyProps) => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const { t } = useTranslation();
  const [appSetupCompleted, setAppSetupCompleted] = useState(false);

  const [previewMode, setPreviewMode] = useState("desktop");
  const ContentRef = useRef<HTMLDivElement | null>(null);

  const enabledLanguages = useMemo(() => survey.languages.filter((l) => l.enabled), [survey.languages]);
  const showLanguageSelector = setLanguageCode && enabledLanguages.length > 1;

  const { projectOverwrites } = survey || {};

  const { placement: surveyPlacement } = projectOverwrites || {};
  const { overlay: surveyOverlay } = projectOverwrites || {};
  const { clickOutsideClose: surveyClickOutsideClose } = projectOverwrites || {};

  const placement = surveyPlacement || project.placement;
  const overlay = surveyOverlay ?? project.overlay;
  const clickOutsideClose = surveyClickOutsideClose ?? project.clickOutsideClose;

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

  const updateElementId = useCallback(
    (newElementId: string) => {
      if (
        !newElementId ||
        newElementId === "hidden" ||
        newElementId === "multiLanguage" ||
        newElementId.includes("fb-variables-")
      )
        return;
      if (newElementId === "start" && !survey.welcomeCard.enabled) return;

      if (newElementId === "start") {
        setBlockId("start");
        return;
      }

      // Convert elementId to blockId and set it directly
      const block = survey.blocks.find((b) => b.elements.some((e) => e.id === newElementId));
      if (block) {
        setBlockId(block.id);
        return;
      }

      // check the endings
      const ending = survey.endings.find((e) => e.id === newElementId);
      if (ending) {
        setBlockId(ending.id);
        return;
      }
    },
    [survey.welcomeCard.enabled, survey.blocks, survey.endings]
  );

  useEffect(() => {
    if (elementId) {
      updateElementId(elementId);
    }
  }, [elementId, updateElementId]);

  const onFinished = () => {
    // close modal if there are no elements left
    if (survey.type === "app" && survey.endings.length === 0) {
      setIsModalOpen(false);
      setTimeout(() => {
        if (survey.blocks[0]) {
          setBlockId(survey.blocks[0].id);
        }
        setIsModalOpen(true);
      }, 500);
    }
  };

  // this useEffect is for refreshing the survey preview only if user is switching between templates on survey templates page and hence we are checking for survey.id === "someUniqeId1" which is a common Id for all templates
  useEffect(() => {
    if (survey.name !== surveyNameTemp && survey.id === "someUniqueId1") {
      resetProgress();
      surveyNameTemp = survey.name;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey]);

  const resetProgress = () => {
    let storePreviewMode = previewMode;
    setPreviewMode("null");
    setTimeout(() => {
      setPreviewMode(storePreviewMode);
    }, 10);

    if (survey.welcomeCard.enabled) {
      setBlockId("start");
    } else if (survey.blocks[0]) {
      setBlockId(survey.blocks[0].id);
    }
  };

  useEffect(() => {
    if (environment) {
      setAppSetupCompleted(environment.appSetupCompleted);
    }
  }, [environment]);

  const isSpamProtectionEnabled = useMemo(() => {
    return isSpamProtectionAllowed && survey.recaptcha?.enabled;
  }, [survey.recaptcha?.enabled, isSpamProtectionAllowed]);

  const handlePreviewModalClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setIsModalOpen(true);
      resetProgress();
    }, 1000);
  };

  if (!previewType) {
    previewType = appSetupCompleted ? "modal" : "fullwidth";

    if (!elementId) {
      return <></>;
    }
  }

  const handlePreviewModeChange = (mode: "mobile" | "desktop") => {
    setPreviewMode(mode);
    requestAnimationFrame(() => {
      if (elementId) {
        updateElementId(elementId);
      }
    });
  };

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-items-center p-2 py-4"
      id="survey-preview">
      <motion.div
        className={cn(
          "z-50 flex h-full w-fit items-center justify-center",
          isFullScreenPreview && "h-full w-full bg-zinc-500/50 backdrop-blur-md"
        )}
        style={{
          position: isFullScreenPreview ? "fixed" : "absolute",
          zIndex: 50,
          left: isFullScreenPreview ? 0 : undefined,
          top: isFullScreenPreview ? 0 : undefined,
        }}
        transition={{
          ease: "easeInOut",
          delay: 1.5,
        }}
      />
      <motion.div
        layout
        style={{
          left: isFullScreenPreview ? "2.5%" : undefined,
          top: isFullScreenPreview ? 0 : undefined,
        }}
        transition={{
          duration: 0.8,
          ease: "easeInOut",
          type: "spring",
        }}
        className={cn(
          "z-50 flex h-[95%] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-300",
          isFullScreenPreview && "absolute z-50 h-[95%] w-[95%]"
        )}>
        {previewMode === "mobile" && (
          <>
            <p className="absolute left-0 top-0 m-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-400">
              {t("common.preview")}
            </p>
            <div className="absolute right-0 top-0 m-2 flex items-center gap-1">
              {showLanguageSelector && (
                <LanguageSelector
                  languages={enabledLanguages}
                  languageCode={languageCode}
                  setLanguageCode={setLanguageCode}
                  locale={locale}
                />
              )}
              <ResetProgressButton onClick={resetProgress} />
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
                  overlay={overlay}
                  clickOutsideClose={clickOutsideClose}
                  borderRadius={styling?.roundness ?? 8}
                  background={styling?.cardBackgroundColor?.light}>
                  <SurveyInline
                    appUrl={publicDomain}
                    isPreviewMode={true}
                    survey={toJsEnvironmentStateSurvey(survey)}
                    isBrandingEnabled={project.inAppSurveyBranding}
                    isRedirectDisabled={true}
                    languageCode={languageCode}
                    styling={styling}
                    isCardBorderVisible={!styling.highlightBorderColor?.light}
                    onClose={handlePreviewModalClose}
                    getSetBlockId={(f: (value: string) => void) => {
                      setBlockId = f;
                    }}
                    onFinished={onFinished}
                    placement={placement}
                    isSpamProtectionEnabled={isSpamProtectionEnabled}
                  />
                </Modal>
              ) : (
                <div className="flex h-full w-full flex-col justify-center px-1">
                  <div className="absolute left-5 top-5">
                    {!styling.isLogoHidden && (
                      <ClientLogo
                        environmentId={environment.id}
                        projectLogo={project.logo}
                        surveyLogo={styling.logo}
                        previewSurvey
                      />
                    )}
                  </div>
                  <div className="z-10 w-full rounded-lg border border-transparent">
                    <SurveyInline
                      appUrl={publicDomain}
                      isPreviewMode={true}
                      survey={toJsEnvironmentStateSurvey({ ...survey, type: "link" })}
                      isBrandingEnabled={project.linkSurveyBranding}
                      languageCode={languageCode}
                      responseCount={42}
                      styling={styling}
                      getSetBlockId={(f: (value: string) => void) => {
                        setBlockId = f;
                      }}
                      isSpamProtectionEnabled={isSpamProtectionEnabled}
                    />
                  </div>
                </div>
              )}
            </MediaBackground>
          </>
        )}
        {previewMode === "desktop" && (
          <div className="flex h-full w-full flex-1 flex-col">
            <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
              <div className="ml-6 flex space-x-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                <button
                  className="h-3 w-3 cursor-pointer rounded-full bg-emerald-500"
                  onClick={() => {
                    if (isFullScreenPreview) {
                      setIsFullScreenPreview(false);
                    } else {
                      setIsFullScreenPreview(true);
                    }
                  }}
                  aria-label={
                    isFullScreenPreview
                      ? t("environments.surveys.edit.shrink_preview")
                      : t("environments.surveys.edit.expand_preview")
                  }></button>
              </div>
              <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                <p>
                  {previewType === "modal"
                    ? t("environments.surveys.edit.your_web_app")
                    : t("common.preview")}
                </p>

                <div className="flex items-center">
                  {showLanguageSelector && (
                    <LanguageSelector
                      languages={enabledLanguages}
                      languageCode={languageCode}
                      setLanguageCode={setLanguageCode}
                      locale={locale}
                    />
                  )}
                  {isFullScreenPreview ? (
                    <ShrinkIcon
                      className="mr-1 h-[22px] w-[22px] cursor-pointer rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
                      onClick={() => {
                        setIsFullScreenPreview(false);
                      }}
                    />
                  ) : (
                    <ExpandIcon
                      className="mr-1 h-[22px] w-[22px] cursor-pointer rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
                      onClick={() => {
                        setIsFullScreenPreview(true);
                      }}
                    />
                  )}
                  <ResetProgressButton onClick={resetProgress} />
                </div>
              </div>
            </div>

            {previewType === "modal" ? (
              <Modal
                isOpen={isModalOpen}
                placement={placement}
                clickOutsideClose={clickOutsideClose}
                overlay={overlay}
                previewMode="desktop"
                borderRadius={styling.roundness ?? 8}
                background={styling.cardBackgroundColor?.light}>
                <SurveyInline
                  appUrl={publicDomain}
                  isPreviewMode={true}
                  survey={toJsEnvironmentStateSurvey(survey)}
                  isBrandingEnabled={project.inAppSurveyBranding}
                  isRedirectDisabled={true}
                  languageCode={languageCode}
                  styling={styling}
                  isCardBorderVisible={!styling.highlightBorderColor?.light}
                  onClose={handlePreviewModalClose}
                  getSetBlockId={(f: (value: string) => void) => {
                    setBlockId = f;
                  }}
                  onFinished={onFinished}
                  isSpamProtectionEnabled={isSpamProtectionEnabled}
                  placement={placement}
                />
              </Modal>
            ) : (
              <MediaBackground
                surveyType={survey.type}
                styling={styling}
                ContentRef={ContentRef as React.RefObject<HTMLDivElement>}
                isEditorView>
                <div className="absolute left-5 top-5">
                  {!styling.isLogoHidden && (
                    <ClientLogo
                      environmentId={environment.id}
                      projectLogo={project.logo}
                      surveyLogo={styling.logo}
                      previewSurvey
                    />
                  )}
                </div>
                <div className="z-0 w-full max-w-4xl rounded-lg border-transparent">
                  <SurveyInline
                    appUrl={publicDomain}
                    isPreviewMode={true}
                    survey={toJsEnvironmentStateSurvey({ ...survey, type: "link" })}
                    isBrandingEnabled={project.linkSurveyBranding}
                    isRedirectDisabled={true}
                    languageCode={languageCode}
                    responseCount={42}
                    styling={styling}
                    getSetBlockId={(f: (value: string) => void) => {
                      setBlockId = f;
                    }}
                    isSpamProtectionEnabled={isSpamProtectionEnabled}
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

const LanguageSelector = ({
  languages,
  languageCode,
  setLanguageCode,
  locale,
}: {
  languages: TSurveyLanguage[];
  languageCode: string;
  setLanguageCode: (code: string) => void;
  locale?: TUserLocale;
}) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mr-1 flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
          aria-label="Change preview language">
          <GlobeIcon className="h-full w-full" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((surveyLang) => {
          const code = surveyLang.default ? "default" : surveyLang.language.code;
          return (
            <DropdownMenuItem
              key={surveyLang.language.code}
              className={cn("text-xs", languageCode === code && "font-semibold")}
              onSelect={() => setLanguageCode(code)}>
              {getLanguageLabel(surveyLang.language.code, locale ?? "en")}
              {surveyLang.default && ` (${t("common.default")})`}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { getPlacementStyle } from "./lib/utils";
