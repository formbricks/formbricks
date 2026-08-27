import type { TJsFileUploadParams, TJsWorkspaceStateSurvey } from "./js";
import type { TResponseData, TResponseHiddenFieldValue, TResponseUpdate } from "./responses";
import type { TUploadFileConfig } from "./storage";
import type { TSurveyStyling } from "./surveys/types";
import type { TWorkspaceStyling } from "./workspace";

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
