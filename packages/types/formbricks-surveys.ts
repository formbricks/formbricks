import type { TJsFileUploadParams, TJsWorkspaceStateSurvey } from "./js";
import type { TResponseData, TResponseHiddenFieldValue, TResponseUpdate } from "./responses";
import type { TUploadFileConfig } from "./storage";
import type { TSurveyStyling } from "./surveys/types";
import type { TWorkspaceStyling } from "./workspace";

/**
 * Viewport rect of the survey card, in CSS pixels, as the renderer measures it.
 *
 * Consumed by the native SDKs, which embed the renderer in a full-screen WebView. A platform
 * WebView hit-tests its whole rectangle and ignores the `pointer-events: none` this renderer puts
 * outside the card, so a survey with no overlay freezes the host app unless the host masks touches
 * itself — and the host cannot know where the card is, because CSS decides that inside the page.
 */
export interface TSurveyCardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurveyBaseProps {
  survey: TJsWorkspaceStateSurvey;
  styling: TSurveyStyling | TWorkspaceStyling;
  isBrandingEnabled: boolean;
  getSetIsError?: (getSetError: (value: boolean) => void) => void;
  getSetIsResponseSendingFinished?: (getSetIsResponseSendingFinished: (value: boolean) => void) => void;
  getSetBlockId?: (getSetBlockId: (value: string) => void) => void;
  getSetResponseData?: (getSetResponseData: (value: TResponseData) => void) => void;
  onDisplay?: () => Promise<void>;
  onResponse?: (response: TResponseUpdate) => void;
  /**
   * Fires when the finished response has been sent. `responseId` is the persisted id when one exists
   * (it always does outside preview/offline, since this is gated on the send completing) — ENG-1846.
   */
  onFinished?: (responseId?: string) => void;
  onClose?: () => void;
  onRetry?: () => void;
  autoFocus?: boolean;
  isRedirectDisabled?: boolean;
  prefillResponseData?: TResponseData;
  skipPrefilled?: boolean;
  languageCode: string;
  dir?: "ltr" | "rtl" | "auto";
  setDir?: (dir: "ltr" | "rtl" | "auto") => void;
  /** Notifies the host of the survey's active language code (e.g. "default", "en-AU", "he").
   *  Link surveys use it to keep the page lang/dir in sync; embedded widgets omit it. */
  onLanguageChange?: (languageCode: string) => void;
  /** Notifies the host which card the respondent is on (initial position + every navigation), so a
   *  link survey can title the document per step (WCAG 2.4.2). `label` is pre-localized in the
   *  SURVEY's active language, which the host does not track — its own i18n is in the viewer's UI
   *  locale. Embedded widgets omit the callback, so a host page is never touched. */
  onPageChange?: (page: { index: number; total: number; label: string }) => void;
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  responseCount?: number;
  isCardBorderVisible?: boolean;
  startAtQuestionId?: string;
  clickOutside?: boolean;
  hiddenFieldsRecord?: TResponseHiddenFieldValue;
  shouldResetQuestionId?: boolean;
  fullSizeCards?: boolean;
  showCardlessPreviewLogoSlot?: boolean;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
}

export interface SurveyModalProps extends SurveyBaseProps {
  clickOutside: boolean;
  overlay: "none" | "light" | "dark";
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
}

export interface SurveyContainerProps extends Omit<SurveyBaseProps, "onFileUpload"> {
  appUrl?: string;
  workspaceId?: string;
  /** Legacy alias for `workspaceId`, sent by old SDKs (e.g. Android ≤ v1.2.0). */
  environmentId?: string;
  isPreviewMode?: boolean;
  userId?: string;
  contactId?: string;
  onDisplayCreated?: () => void | Promise<void>;
  /**
   * Fires once per survey lifecycle when the response exists. Outside preview mode that is the
   * server's creation ack, so `responseId` is the persisted id (ENG-1846 — the host uses it to link
   * session replays); in preview mode it fires at submit time with no id, since nothing is stored.
   */
  onResponseCreated?: (responseId?: string) => void | Promise<void>;
  onFileUpload?: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  /** Notifies the host where the survey card is, and `null` once no card is on screen (while it
   *  animates out, or before the first paint). Exists so a native host can pass touches outside the
   *  card through to the app — see `TSurveyCardRect` for why it cannot work that out for itself.
   *
   *  Modal mode only, and nothing is measured unless a host passes it: web hosts omit it, because
   *  CSS `pointer-events` already does the job inside a page. Reported on open, on every resize of
   *  the card (each question changes its height), and on viewport resize or rotation. */
  onCardRectChange?: (rect: TSurveyCardRect | null) => void;
  mode?: "modal" | "inline";
  containerId?: string;
  overlay?: "none" | "light" | "dark";
  placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
  action?: string;
  singleUseId?: string;
  singleUseResponseId?: string;
  pinAuthToken?: string;
  isWebEnvironment?: boolean;
  isSpamProtectionEnabled?: boolean;
  recaptchaSiteKey?: string;
  getRecaptchaToken?: () => Promise<string | null>;
  offlineSupport?: boolean;
  onOfflineStatusChange?: (status: {
    isOnline: boolean;
    isSyncing: boolean;
    pendingSyncCount: number;
  }) => void;
}
