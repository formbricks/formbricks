"use client";

import { MotionConfig, motion } from "framer-motion";
import { ExpandIcon, GlobeIcon, MonitorIcon, ShrinkIcon, SmartphoneIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { getLinkSurveyCardMaxWidth } from "@formbricks/types/styling";
import { TSurvey, TSurveyLanguage, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { CardlessPreviewLogo } from "@/modules/ui/components/cardless-preview-logo";
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
  workspace: Workspace;
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
  workspace,
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
  const { workspaceOverwrites } = survey || {};

  const { placement: surveyPlacement } = workspaceOverwrites || {};
  const { overlay: surveyOverlay } = workspaceOverwrites || {};
  const { clickOutsideClose: surveyClickOutsideClose } = workspaceOverwrites || {};

  const placement = surveyPlacement || workspace.placement;
  const overlay = surveyOverlay ?? workspace.overlay;
  const clickOutsideClose = surveyClickOutsideClose ?? workspace.clickOutsideClose;

  const styling: TSurveyStyling | TWorkspaceStyling = useMemo(() => {
    // allow style overwrite is disabled from the workspace
    if (!workspace.styling.allowStyleOverwrite) {
      return workspace.styling;
    }

    // allow style overwrite is enabled from the workspace
    if (workspace.styling.allowStyleOverwrite) {
      // survey style overwrite is disabled
      if (!survey.styling?.overwriteThemeStyling) {
        return workspace.styling;
      }

      // survey style overwrite is enabled
      return survey.styling;
    }

    return workspace.styling;
  }, [workspace.styling, survey.styling]);

  const isCardless = styling.cardArrangement?.linkSurveys === "cardless";
  const linkSurveyCardMaxWidth = getLinkSurveyCardMaxWidth(styling.linkSurveyCardWidth);

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
    if (workspace) {
      setAppSetupCompleted(workspace.appSetupCompleted);
    }
  }, [workspace]);

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
    <MotionConfig reducedMotion="user">
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
                isMobilePreview
                useNaturalHeight={isCardless}>
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
                      survey={toJsWorkspaceStateSurvey(survey)}
                      isBrandingEnabled={workspace.inAppSurveyBranding}
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
                  <div
                    className={cn(
                      "flex h-full w-full flex-col px-1",
                      isCardless ? "min-h-0 overflow-hidden" : "justify-center"
                    )}>
                    {!styling.isLogoHidden && !isCardless && (
                      <div className="absolute left-5 top-5">
                        <ClientLogo
                          workspaceLogo={workspace.logo}
                          workspaceId={workspace.id}
                          surveyLogo={styling.logo}
                          previewSurvey
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "w-full",
                        isCardless
                          ? "flex min-h-0 w-full flex-1 flex-col"
                          : "z-10 mx-auto rounded-lg border border-transparent"
                      )}
                      style={isCardless ? undefined : { maxWidth: linkSurveyCardMaxWidth }}>
                      <div
                        className={cn(
                          "flex min-h-0 w-full flex-1 flex-col",
                          !isCardless && "justify-center"
                        )}>
                        <SurveyInline
                          appUrl={publicDomain}
                          isPreviewMode={true}
                          isBrandingEnabled={workspace.linkSurveyBranding}
                          survey={toJsWorkspaceStateSurvey({ ...survey, type: "link" })}
                          isRedirectDisabled={true}
                          languageCode={languageCode}
                          responseCount={42}
                          styling={styling}
                          showCardlessPreviewLogoSlot={!styling.isLogoHidden}
                          getSetBlockId={(f: (value: string) => void) => {
                            setBlockId = f;
                          }}
                          isSpamProtectionEnabled={isSpamProtectionEnabled}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </MediaBackground>
            </>
          )}
          {previewMode === "desktop" && (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
              <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
                <div className="ml-6 flex gap-x-2">
                  <div className="size-3 rounded-full bg-red-500"></div>
                  <div className="size-3 rounded-full bg-amber-500"></div>
                  <button
                    type="button"
                    className="size-3 cursor-pointer rounded-full bg-emerald-500"
                    onClick={() => {
                      if (isFullScreenPreview) {
                        setIsFullScreenPreview(false);
                      } else {
                        setIsFullScreenPreview(true);
                      }
                    }}
                    aria-label={
                      isFullScreenPreview
                        ? t("workspace.surveys.edit.shrink_preview")
                        : t("workspace.surveys.edit.expand_preview")
                    }></button>
                </div>
                <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                  <p>
                    {previewType === "modal" ? t("workspace.surveys.edit.your_web_app") : t("common.preview")}
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
                        className="mr-1 size-[22px] cursor-pointer rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
                        onClick={() => {
                          setIsFullScreenPreview(false);
                        }}
                      />
                    ) : (
                      <ExpandIcon
                        className="mr-1 size-[22px] cursor-pointer rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
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
                    survey={toJsWorkspaceStateSurvey(survey)}
                    isBrandingEnabled={workspace.inAppSurveyBranding}
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
                  isEditorView
                  useNaturalHeight={isCardless}>
                  <div
                    className={cn(
                      "flex w-full justify-center",
                      isCardless
                        ? "h-full min-h-0 flex-1 flex-col items-stretch overflow-hidden"
                        : "h-full items-center"
                    )}>
                    {!styling.isLogoHidden && !isCardless && (
                      <div className="absolute left-5 top-5">
                        <ClientLogo
                          workspaceLogo={workspace.logo}
                          workspaceId={workspace.id}
                          surveyLogo={styling.logo}
                          previewSurvey
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "w-full",
                        isCardless
                          ? "flex min-h-0 w-full flex-1 flex-col"
                          : "z-0 mx-auto rounded-lg border-transparent"
                      )}
                      style={isCardless ? undefined : { maxWidth: linkSurveyCardMaxWidth }}>
                      <div
                        className={cn(
                          "flex min-h-0 w-full flex-1 flex-col",
                          !isCardless && "justify-center"
                        )}>
                        <SurveyInline
                          appUrl={publicDomain}
                          isPreviewMode={true}
                          survey={toJsWorkspaceStateSurvey({ ...survey, type: "link" })}
                          isBrandingEnabled={workspace.linkSurveyBranding}
                          isRedirectDisabled={true}
                          languageCode={languageCode}
                          responseCount={42}
                          styling={styling}
                          showCardlessPreviewLogoSlot={!styling.isLogoHidden}
                          getSetBlockId={(f: (value: string) => void) => {
                            setBlockId = f;
                          }}
                          isSpamProtectionEnabled={isSpamProtectionEnabled}
                        />
                      </div>
                    </div>
                  </div>
                </MediaBackground>
              )}
            </div>
          )}
        </motion.div>

        {isCardless && previewType !== "modal" && !styling.isLogoHidden && (
          <CardlessPreviewLogo
            workspaceLogo={workspace.logo}
            workspaceId={workspace.id}
            surveyLogo={styling.logo}
            mountKey={`${previewMode}-${survey.id}`}
          />
        )}

        {/* for toggling between mobile and desktop mode  */}
        <div className="mt-2 flex rounded-full border-2 border-slate-300 p-1">
          <TabOption
            active={previewMode === "mobile"}
            icon={<SmartphoneIcon className="mx-4 my-2 size-4 text-slate-700" />}
            onClick={() => handlePreviewModeChange("mobile")}
          />
          <TabOption
            active={previewMode === "desktop"}
            icon={<MonitorIcon className="mx-4 my-2 size-4 text-slate-700" />}
            onClick={() => handlePreviewModeChange("desktop")}
          />
        </div>
      </div>
    </MotionConfig>
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
          className="mr-1 flex size-[22px] cursor-pointer items-center justify-center rounded-md bg-white p-1 text-slate-500 hover:text-slate-700"
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
