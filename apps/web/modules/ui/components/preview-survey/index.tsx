"use client";

import { MotionConfig, motion } from "framer-motion";
import { ExpandIcon, GlobeIcon, ShrinkIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import type { TRendererCustomCss } from "@formbricks/types/custom-css";
import { resolveDarkColors } from "@formbricks/types/dark-palette";
import { resolveOverlayAppearance } from "@formbricks/types/overlay";
import { getLinkSurveyCardMaxWidth } from "@formbricks/types/styling";
import { TSurvey, TSurveyLanguage, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { type TStylingAppearance } from "@/lib/styling/dark-mode";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import { describeRuleSummary } from "@/modules/survey/editor/lib/flow-outline-text";
import { isRTLLanguage } from "@/modules/survey/link/lib/utils";
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
import { PreviewModeSwitches, PreviewWindowBar } from "./components/preview-frame";
import { StartScreenOutBanner } from "./components/start-screen-out-banner";
import {
  type TTestValuesOpenRequest,
  TestValuesControl,
  TestValuesStrip,
} from "./components/test-values-control";
import { PREVIEW_BOUNDARY_CLASS_NAME, previewBoundaryProps } from "./lib/containment";
import { INITIAL_FOLLOW_STATE, followActiveElement } from "./lib/follow-active-element";
import { findStartScreenOut, getScreenOutFieldKey } from "./lib/start-screen-out";
import {
  getPreviewStartKey,
  getTestValueEntries,
  getTestValueFields,
  restartsPreviewOnFinish,
} from "./lib/test-values";
import { mirrorPlacementForDir } from "./lib/utils";

type TPreviewType = "modal" | "fullwidth" | "email";

interface PreviewSurveyProps {
  survey: TSurvey;
  elementId?: string | null;
  previewType?: TPreviewType;
  workspace: TWorkspaceWithoutCustomCss;
  languageCode: string;
  setLanguageCode?: (code: string) => void;
  locale?: TUserLocale;
  isSpamProtectionAllowed: boolean;
  publicDomain: string;
  /** Dark only applies to app surveys; link previews stay light (D4). */
  appearance?: TStylingAppearance;
  /** Shows the sun / moon switch next to the device toggle when set. */
  onAppearanceChange?: (appearance: TStylingAppearance) => void;
  /**
   * Compiled workspace + survey custom CSS to preview (ENG-3552): the editor's validated draft. Passed
   * straight to the renderer, which applies CSS from this prop only — never from `survey`.
   */
  customCss?: TRendererCustomCss;
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
  appearance = "light",
  onAppearanceChange,
  customCss,
}: Readonly<PreviewSurveyProps>) => {
  // Both callers hand over a survey that already carries its `embeddedFields`: the editor's working
  // copy is rows-native (ENG-2628), and the templates gallery builds its never-written survey through
  // `getTemplatePreviewSurvey`, which adapts the preset's legacy keys at that boundary (ENG-2404).
  const jsSurvey = useMemo(() => toJsWorkspaceStateSurvey(survey), [survey]);
  const jsLinkSurvey = useMemo(() => toJsWorkspaceStateSurvey({ ...survey, type: "link" }), [survey]);

  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const { t, i18n } = useTranslation();
  const [appSetupCompleted, setAppSetupCompleted] = useState(false);

  const [previewMode, setPreviewMode] = useState("desktop");

  // "Test values" (ENG-6932): URL parameters and hidden fields for the preview, empty by default. The
  // rules before the first question run when the survey loads, so the preview is keyed by the values
  // and those rules, and starts over whenever they change.
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const testValueFields = useMemo(() => getTestValueFields(survey), [survey]);
  // What the preview runs with: each value as its field's link would carry it (ENG-6953).
  const testValueEntries = useMemo(
    () => getTestValueEntries(testValues, testValueFields),
    [testValues, testValueFields]
  );
  const hiddenFieldsRecord = useMemo(() => Object.fromEntries(testValueEntries), [testValueEntries]);
  // The strip's Clear (ENG-6969 T13 ②): no values means a new start key, so the preview restarts.
  const clearTestValues = () => setTestValues({});
  // Bumped when an app survey without endings finishes, to start it over (see `onFinished`).
  const [previewRun, setPreviewRun] = useState(0);
  const previewStartKey = useMemo(
    () => getPreviewStartKey(hiddenFieldsRecord, survey.startLogic ?? [], previewRun),
    [hiddenFieldsRecord, survey.startLogic, previewRun]
  );
  // "Set test values" on the banner opens the Test values panel on the field its rule reads.
  const [testValuesOpenRequest, setTestValuesOpenRequest] = useState<TTestValuesOpenRequest>();
  // Whether the preview left where it started to show a question the author picked (see the follow
  // effect below): the banner then no longer describes what the preview shows. A new start resets it.
  const [hasFollowedQuestion, setHasFollowedQuestion] = useState(false);
  const [followResetKey, setFollowResetKey] = useState(previewStartKey);
  if (followResetKey !== previewStartKey) {
    setFollowResetKey(previewStartKey);
    setHasFollowedQuestion(false);
  }
  // Why the preview opened on an ending (ENG-6969 T13 ①): the rule before the first question that
  // screened it out with these test values, worked out here as the renderer decides it. Endings
  // reached later, by a block's rule, aren't explained: they depend on the answers typed in the preview.
  const startScreenOut = useMemo(
    () =>
      findStartScreenOut({
        survey: jsSurvey,
        hiddenFieldsRecord,
        languageCode,
        // The renderer runs in the editor's page, so a reserved `url` reads the editor's address.
        meta: typeof window === "undefined" ? {} : { url: window.location.href },
      }),
    [jsSurvey, hiddenFieldsRecord, languageCode]
  );
  const startScreenOutSummary = startScreenOut
    ? describeRuleSummary(startScreenOut.rule, survey, t, {
        locale: i18n.resolvedLanguage ?? i18n.language ?? "en-US",
      })
    : undefined;
  const openTestValuesForScreenOut =
    startScreenOut && testValueFields.length > 0
      ? () =>
          setTestValuesOpenRequest((current) => ({
            id: (current?.id ?? 0) + 1,
            fieldKey: getScreenOutFieldKey(
              startScreenOut.rule,
              testValueFields.map(({ key }) => key)
            ),
          }))
      : undefined;
  const renderScreenOutBanner = (className?: string) =>
    startScreenOutSummary && !hasFollowedQuestion ? (
      <StartScreenOutBanner
        ruleSummary={startScreenOutSummary}
        onSetTestValues={openTestValuesForScreenOut}
        className={className}
      />
    ) : null;
  const ContentRef = useRef<HTMLDivElement | null>(null);
  const enabledLanguages = useMemo(() => survey.languages.filter((l) => l.enabled), [survey.languages]);
  const showLanguageSelector = setLanguageCode && enabledLanguages.length > 1;
  const { workspaceOverwrites } = survey || {};

  const { placement: surveyPlacement } = workspaceOverwrites || {};
  const { clickOutsideClose: surveyClickOutsideClose } = workspaceOverwrites || {};

  // Placement mirrors with the previewed language, exactly as the shipped widget does — see
  // `mirrorPlacementForDir`.
  //
  // The input is the language the RENDERED SURVEY is actually on, not the `languageCode` prop. The
  // previewed survey carries its own language switch (`getShowLanguageSwitch` in survey.tsx gates only
  // on `showLanguageSwitch` and the enabled-language count, so it is present in preview mode too), and
  // an author who uses it changes the survey's direction without touching this prop. Keying the mirror
  // on the prop alone left an LTR survey sitting in the RTL corner on exactly that path — the
  // contradiction between preview and shipped widget this is here to remove.
  //
  // Tracked in local state rather than reported up through `setLanguageCode`: that state is the
  // editor's *editing* language and also drives the question pane (`survey-editor.tsx`), so a language
  // switch inside the preview must not retarget what the author is typing into.
  const [activeLanguageCode, setActiveLanguageCode] = useState(languageCode);

  // Covers the prop changes the chrome does NOT make: the editor resets its editing language to
  // "default" when the selected one stops being enabled (`survey-editor.tsx`). The chrome's own
  // clicks are handled by `handleChromeLanguageChange` below rather than here.
  useEffect(() => {
    setActiveLanguageCode(languageCode);
  }, [languageCode]);

  // Sets BOTH, because picking the language the prop already holds is a same-value setState: React
  // bails and the effect above never re-runs. That is exactly the "put it back after an in-survey
  // switch" click — both switches spell the default language `"default"` — so keying the reset on the
  // prop alone left the question pane on the editing language and the preview on the other one.
  const handleChromeLanguageChange = useCallback(
    (code: string) => {
      setLanguageCode?.(code);
      setActiveLanguageCode(code);
    },
    [setLanguageCode]
  );

  // Both modal previews are rendered behind a `previewMode === …` gate, so switching between the phone
  // and browser frames unmounts one and mounts the other — and a fresh RenderSurvey seeds its language
  // from whatever `languageCode` prop it is handed. Handing it the prop would reset the survey to the
  // editing language while `placement` still reflected the language the author had switched to, sliding
  // an Arabic card across the viewport to the LTR corner before the remounted survey reported its own
  // language back and moved it again. Seeding from the active language keeps content and corner in step
  // by construction, and carries the author's in-survey choice across the frame toggle.

  const placement = mirrorPlacementForDir(
    surveyPlacement || workspace.placement,
    isRTLLanguage(jsSurvey, activeLanguageCode) ? "rtl" : "ltr"
  );
  const {
    overlay,
    color: overlayColor,
    opacity: overlayOpacity,
  } = resolveOverlayAppearance(workspaceOverwrites, workspace);
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

  // Page font (ENG-3864): the app survey takes the font of the page around it, here the editor's.
  const pageFont = (styling.pageFont ?? workspace.styling.pageFont) === true;

  const isCardless = styling.cardArrangement?.linkSurveys === "cardless";
  // The mock modal paints its own card color around the survey, so it has to follow the dark palette.
  const modalBackground =
    appearance === "dark"
      ? resolveDarkColors(styling).cardBackgroundColor
      : styling.cardBackgroundColor?.light;
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

  // The preview follows the question the author works on, but opens like the live survey: the
  // question the editor activates by itself is not followed, so the rules before the first question
  // and the welcome card decide the first card here too (ENG-6932, see `followActiveElement`).
  const followStateRef = useRef(INITIAL_FOLLOW_STATE);
  useEffect(() => {
    const { state, follow } = followActiveElement(followStateRef.current, elementId ?? null);
    followStateRef.current = state;
    if (follow && elementId) {
      updateElementId(elementId);
      setHasFollowedQuestion(true);
    }
  }, [elementId, updateElementId]);

  const onFinished = () => {
    // close modal if there are no elements left, then start over: a remount runs the rules before the
    // first question and the first page's show-if again, as the live survey does for a new respondent.
    if (restartsPreviewOnFinish(survey)) {
      setIsModalOpen(false);
      setTimeout(() => {
        setPreviewRun((run) => run + 1);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh preview only when `survey` changes; resetProgress is recreated each render, so depending on it would re-run every render
  }, [survey]);

  const resetProgress = () => {
    // A restart runs the rules before the first question again, so the banner may apply again.
    setHasFollowedQuestion(false);
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
      if (elementId && followStateRef.current.picked) {
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
            "relative z-50 flex h-[95%] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-300",
            isFullScreenPreview && "absolute z-50 h-[95%] w-[95%]"
          )}>
          {previewMode === "mobile" && (
            <>
              <p className="absolute top-0 left-0 m-2 rounded-sm bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {t("common.preview")}
              </p>
              <div className="absolute top-0 right-0 m-2 flex items-center gap-1">
                {showLanguageSelector && (
                  <LanguageSelector
                    languages={enabledLanguages}
                    languageCode={languageCode}
                    setLanguageCode={handleChromeLanguageChange}
                    locale={locale}
                  />
                )}
                <TestValuesControl
                  fields={testValueFields}
                  values={testValues}
                  activeCount={testValueEntries.length}
                  onApply={setTestValues}
                  openRequest={testValuesOpenRequest}
                />
                <ResetProgressButton onClick={resetProgress} />
              </div>
              <div className="absolute inset-x-2 top-10 z-20 flex flex-col gap-1">
                <TestValuesStrip
                  entries={testValueEntries}
                  onClear={clearTestValues}
                  className="w-auto rounded-md border"
                />
                {renderScreenOutBanner("w-auto rounded-md border")}
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
                    overlayColor={overlayColor}
                    overlayOpacity={overlayOpacity}
                    clickOutsideClose={clickOutsideClose}
                    borderRadius={styling?.roundness ?? 8}
                    background={modalBackground}>
                    <SurveyInline
                      key={previewStartKey}
                      hiddenFieldsRecord={hiddenFieldsRecord}
                      appUrl={publicDomain}
                      isPreviewMode={true}
                      // The preview restarts when a rule before the first question changes; a card focusing itself then
                      // would take focus from the editor field being typed in. Cards focus once the author clicks Next or Back.
                      autoFocus={false}
                      customCss={customCss}
                      survey={jsSurvey}
                      appearance={appearance}
                      isBrandingEnabled={workspace.inAppSurveyBranding}
                      isRedirectDisabled={true}
                      languageCode={activeLanguageCode}
                      styling={styling}
                      pageFont={pageFont}
                      isCardBorderVisible={!styling.highlightBorderColor?.light}
                      onClose={handlePreviewModalClose}
                      getSetBlockId={(f: (value: string) => void) => {
                        setBlockId = f;
                      }}
                      onFinished={onFinished}
                      onLanguageChange={setActiveLanguageCode}
                      placement={placement}
                      isSpamProtectionEnabled={isSpamProtectionEnabled}
                    />
                  </Modal>
                ) : (
                  <div
                    {...previewBoundaryProps}
                    className={cn(
                      "flex h-full w-full flex-col px-1",
                      PREVIEW_BOUNDARY_CLASS_NAME,
                      isCardless ? "min-h-0 overflow-hidden" : "justify-center"
                    )}>
                    {!styling.isLogoHidden && !isCardless && (
                      <div className="absolute top-5 left-5">
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
                          key={previewStartKey}
                          hiddenFieldsRecord={hiddenFieldsRecord}
                          appUrl={publicDomain}
                          isPreviewMode={true}
                          // The preview restarts when a rule before the first question changes; a card focusing itself then
                          // would take focus from the editor field being typed in. Cards focus once the author clicks Next or Back.
                          autoFocus={false}
                          customCss={customCss}
                          isBrandingEnabled={workspace.linkSurveyBranding}
                          survey={jsLinkSurvey}
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
              <PreviewWindowBar
                title={
                  previewType === "modal" ? t("workspace.surveys.edit.your_web_app") : t("common.preview")
                }
                expand={{
                  isExpanded: isFullScreenPreview,
                  onToggle: () => setIsFullScreenPreview(!isFullScreenPreview),
                  label: isFullScreenPreview
                    ? t("workspace.surveys.edit.shrink_preview")
                    : t("workspace.surveys.edit.expand_preview"),
                }}>
                {showLanguageSelector && (
                  <LanguageSelector
                    languages={enabledLanguages}
                    languageCode={languageCode}
                    setLanguageCode={handleChromeLanguageChange}
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
                <TestValuesControl
                  fields={testValueFields}
                  values={testValues}
                  activeCount={testValueEntries.length}
                  onApply={setTestValues}
                  openRequest={testValuesOpenRequest}
                />
                <ResetProgressButton onClick={resetProgress} />
              </PreviewWindowBar>

              <TestValuesStrip entries={testValueEntries} onClear={clearTestValues} />
              {renderScreenOutBanner()}

              {/* The trusted box the survey is contained in, below the chrome and its controls. */}
              <div
                {...previewBoundaryProps}
                className={cn("flex min-h-0 w-full flex-1 flex-col", PREVIEW_BOUNDARY_CLASS_NAME)}>
                {previewType === "modal" ? (
                  <Modal
                    isOpen={isModalOpen}
                    placement={placement}
                    clickOutsideClose={clickOutsideClose}
                    overlay={overlay}
                    overlayColor={overlayColor}
                    overlayOpacity={overlayOpacity}
                    previewMode="desktop"
                    borderRadius={styling.roundness ?? 8}
                    background={modalBackground}>
                    <SurveyInline
                      key={previewStartKey}
                      hiddenFieldsRecord={hiddenFieldsRecord}
                      appUrl={publicDomain}
                      isPreviewMode={true}
                      // The preview restarts when a rule before the first question changes; a card focusing itself then
                      // would take focus from the editor field being typed in. Cards focus once the author clicks Next or Back.
                      autoFocus={false}
                      customCss={customCss}
                      survey={jsSurvey}
                      appearance={appearance}
                      isBrandingEnabled={workspace.inAppSurveyBranding}
                      isRedirectDisabled={true}
                      languageCode={activeLanguageCode}
                      styling={styling}
                      pageFont={pageFont}
                      isCardBorderVisible={!styling.highlightBorderColor?.light}
                      onClose={handlePreviewModalClose}
                      getSetBlockId={(f: (value: string) => void) => {
                        setBlockId = f;
                      }}
                      onFinished={onFinished}
                      onLanguageChange={setActiveLanguageCode}
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
                        <div className="absolute top-5 left-5">
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
                            key={previewStartKey}
                            hiddenFieldsRecord={hiddenFieldsRecord}
                            appUrl={publicDomain}
                            isPreviewMode={true}
                            // The preview restarts when a rule before the first question changes; a card focusing itself then
                            // would take focus from the editor field being typed in. Cards focus once the author clicks Next or Back.
                            autoFocus={false}
                            customCss={customCss}
                            survey={jsLinkSurvey}
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

        <PreviewModeSwitches
          previewMode={previewMode === "mobile" || previewMode === "desktop" ? previewMode : null}
          onPreviewModeChange={handlePreviewModeChange}
          appearance={appearance}
          onAppearanceChange={onAppearanceChange}
        />
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
  readonly languages: TSurveyLanguage[];
  readonly languageCode: string;
  readonly setLanguageCode: (code: string) => void;
  readonly locale?: TUserLocale;
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
