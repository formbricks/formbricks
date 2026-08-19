import { type ComponentChildren } from "preact";
import { type MutableRef, useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TOverlay, type TPlacement } from "@formbricks/types/common";
import { ensureLiveRegion } from "@/lib/live-region";
import { SURVEY_INSTRUCTIONS_ID } from "@/lib/survey-page";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

// Give a fallback-created live region (older SDK, see live-region.ts) a beat to be registered by
// assistive tech before the message lands. Harmless when the region already exists.
const ANNOUNCE_DELAY_MS = 100;

type UseNoOverlayModalOptions = {
  /** True only for a modal survey that is open and has NO overlay — the case both effects exist for. */
  enabled: boolean;
  containerRef: MutableRef<HTMLDivElement | null>;
  onClose?: () => void;
  /** Localized text announced when the survey appears. */
  announcement: string;
};

/**
 * The two things a modal survey rendered WITHOUT an overlay has to do for itself, because the focus
 * trap that normally handles them is deliberately off in that case (trapping focus on a survey that
 * does not block the page would steal the caret from the host page).
 *
 * 1. Handle Escape. The listener sits on the container node rather than on `document`, so Escape
 *    closes the survey only while focus is inside it and never cancels the host page's own Escape
 *    handling. It stays imperative because a keydown JSX prop on a non-interactive role="dialog"
 *    element fails a11y linting.
 * 2. Announce itself. With no overlay the survey never takes focus, so without this a screen-reader
 *    user gets no signal that it appeared. The announcement is cleared on close, because setting
 *    identical text twice is not a change and a later open would otherwise stay silent.
 *
 * Extracted from SurveyContainer, which SonarQube flagged for cognitive complexity (S3776): these
 * two effects and their nested handlers carried most of its branching, and neither has anything to
 * do with rendering the container. S3776 is measured per function, so pulling them out of the
 * component is what reduces its score — the file they sit in does not matter to the rule.
 *
 * It lives here rather than in lib/ deliberately. It has exactly one call site and is specific to
 * this component's modal semantics, so it is not shared code; and its whole behaviour is DOM
 * listeners and a timer, which per AGENTS.md is covered by Playwright rather than unit tests. As a
 * lib/*.ts module it would have added 22 lines the repo does not unit-test on principle, failing the
 * new-code coverage gate for a refactor that changes no behaviour.
 */
const useNoOverlayModal = ({
  enabled,
  containerRef,
  onClose,
  announcement,
}: UseNoOverlayModalOptions): void => {
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.altKey || event.ctrlKey || event.metaKey) return;

      event.preventDefault();
      onClose?.();
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onClose, containerRef]);

  useEffect(() => {
    if (!enabled) return;

    const liveRegion = ensureLiveRegion();
    liveRegion.textContent = "";
    const announceTimeout = setTimeout(() => {
      liveRegion.textContent = announcement;
    }, ANNOUNCE_DELAY_MS);

    return () => {
      clearTimeout(announceTimeout);
      liveRegion.textContent = "";
    };
  }, [enabled, announcement]);
};

// Class computations for the modal chrome, at module scope alongside getPlacementStyle. They read
// nothing but their arguments, and keeping them out of the component body is what actually moves
// SonarQube's cognitive-complexity number (S3776): it scores each function separately, so a
// conditional inside a nested arrow — a useEffect callback, say — never counted against
// SurveyContainer, while every ternary and && inline in its JSX did.
const getModalLayerClass = (isModal: boolean, hasOverlay: boolean): string =>
  cn(
    hasOverlay ? "pointer-events-auto" : "pointer-events-none",
    isModal && "fixed inset-0 z-999999 flex items-end"
  );

// Only a modal survey paints a backdrop, and the two overlay settings are mutually exclusive, so at
// most one class can ever apply.
const getOverlayBackdropClass = (isModal: boolean, overlay: TOverlay): string => {
  if (!isModal) return "";
  if (overlay === "dark") return "bg-slate-700/80";
  if (overlay === "light") return "bg-slate-400/50";
  return "";
};

const getPlacementStyle = (placement: TPlacement): string => {
  switch (placement) {
    case "bottomRight":
      return "sm:bottom-3 sm:right-3";
    case "topRight":
      return "sm:top-3 sm:right-3 sm:bottom-3";
    case "topLeft":
      return "sm:top-3 sm:left-3 sm:bottom-3";
    case "bottomLeft":
      return "sm:bottom-3 sm:left-3";
    case "center":
      return "sm:top-1/2 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2";
    default:
      return "sm:bottom-3 sm:right-3";
  }
};

interface SurveyContainerProps {
  mode: "modal" | "inline";
  placement?: TPlacement;
  overlay?: TOverlay;
  children: ComponentChildren;
  onClose?: () => void;
  clickOutside?: boolean;
  isOpen?: boolean;
  dir?: "ltr" | "rtl" | "auto";
  /**
   * Survey name. Carries two a11y jobs that happen to want the same string: it is the survey's
   * single top-level heading (WCAG 2.4.6) and the form's accessible name (WCAG 2.4.2).
   */
  surveyName?: string;
  /** Whether the survey renders a persistent instructions region worth describing the form with. */
  hasInstructions?: boolean;
}

export function SurveyContainer({
  mode,
  placement = "bottomRight",
  overlay = "none",
  children,
  onClose,
  clickOutside,
  isOpen = true,
  dir = "auto",
  surveyName,
  hasInstructions = false,
}: Readonly<SurveyContainerProps>) {
  const isModal = mode === "modal";
  const { t } = useTranslation();
  const hasOverlay = overlay !== "none";
  // The overlay is what makes a survey modal: it covers the host page and the page stops being usable.
  // Without one the page underneath stays visible and clickable, so the survey is a notification, not a
  // modal. Trapping focus there steals the caret and the text selection from the host page — the trap's
  // document-level listeners pull focus back in on every click, tab and drag. Matches the gate the
  // click-outside effect below already uses.
  const modalRef = useFocusTrap<HTMLDivElement>({
    enabled: isModal && isOpen && hasOverlay,
    onEscapeKeyDown: onClose,
  });

  useEffect(() => {
    if (!isModal) return;
    if (!clickOutside) return;
    if (!hasOverlay) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        modalRef.current &&
        !(modalRef.current as HTMLElement).contains(e.target as Node) &&
        onClose
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clickOutside, hasOverlay, modalRef, onClose, isModal, isOpen]);

  // Escape handling and the open announcement, both of which only a modal survey WITHOUT an overlay
  // has to do for itself — see the hook for why.
  useNoOverlayModal({
    enabled: isModal && isOpen && !hasOverlay,
    containerRef: modalRef,
    onClose,
    announcement: t("common.survey_opened_announcement"),
  });

  if (!isOpen) return null;

  // The survey's one top-level heading. Card headlines (welcome, element prompts, ending) are all
  // h2, so without this they would be orphaned: a screen reader user pressing H would land inside
  // the survey with nothing naming what they are answering. It lives here rather than in
  // survey.tsx's getCardContent, which runs once per card and would emit one h1 per peeking card
  // in the stacked layout. Visually hidden because the card designs have no room for a title — the
  // survey name is already the document title on link surveys.
  //
  // It is rendered as a sibling of `children` in BOTH branches so that it always ends up inside the
  // dialog on the modal path: `aria-modal="true"` makes assistive tech ignore everything outside
  // the dialog element, so a heading placed on the #fbjs root would be unreachable there.
  const surveyHeading = surveyName ? <h1 className="sr-only">{surveyName}</h1> : null;

  // The VPAT finding is that "forms themselves have no titles": every input had a label, but the
  // form they belong to had no accessible name at all. role="form" + the survey name fixes that for
  // BOTH surfaces — an embedded survey cannot own the host document's <title>, so this is the only
  // name it can carry. The role is only declared once there is a name to give it: an unnamed form
  // landmark is noise in a screen reader's landmark list rather than an improvement.
  // Survey instructions used to appear on the welcome card and never again. Pointing the form at the
  // persistent region means they are announced on entry to every page.
  //
  // role="form" on a div rather than a native <form>, which is what Sonar's S6819 asks for, because
  // neither of the two things a real form element brings is safe here. An inline survey is rendered
  // into a container the host page supplies by id (see packages/surveys/src/index.ts), which can sit
  // anywhere in their document — including inside their own <form>. Nested forms are invalid HTML and
  // the browser drops the inner one, which would silently take this accessible name with it. And a
  // real form makes Enter in any text input submit and navigate away from a half-finished survey.
  // The role gives assistive tech the same landmark without either behaviour.
  const instructionsId = surveyName && hasInstructions ? SURVEY_INSTRUCTIONS_ID : undefined;

  if (!isModal) {
    return (
      <div // NOSONAR(typescript:S6819) - a native <form> would nest inside the host page's own form
        id="fbjs"
        className="formbricks-form"
        style={{ height: "100%", width: "100%" }}
        dir={dir}
        role={surveyName ? "form" : undefined}
        aria-label={surveyName}
        aria-describedby={instructionsId}>
        {surveyHeading}
        {children}
      </div>
    );
  }

  return (
    <div id="fbjs" className="formbricks-form" dir={dir}>
      <div
        // In-dialog updates (question changes after a submit) should wait for the reader to finish
        // speaking instead of interrupting it. A survey is never urgent enough for assertive speech.
        aria-live="polite"
        className={getModalLayerClass(isModal, hasOverlay)}>
        <div
          className={cn(
            "relative h-full w-full transition-all duration-500 ease-in-out",
            getOverlayBackdropClass(isModal, overlay)
          )}>
          <div
            ref={modalRef}
            role="dialog"
            // Only a survey that actually blocks the page is a modal dialog. `aria-modal` makes
            // assistive tech ignore everything outside it, so setting it on a corner survey hides the
            // host page from screen-reader users while they can still see and use it.
            aria-modal={hasOverlay ? "true" : undefined}
            // The survey name is strictly more informative than the generic "Survey Dialog", which
            // stays as the fallback for a survey rendered without one (previews).
            aria-label={surveyName ?? t("common.survey_dialog")}
            aria-describedby={hasInstructions ? SURVEY_INSTRUCTIONS_ID : undefined}
            tabIndex={-1}
            className={cn(
              getPlacementStyle(placement),
              isOpen ? "opacity-100" : "opacity-0",
              "rounded-custom pointer-events-auto absolute bottom-0 h-fit w-full overflow-visible bg-white shadow-lg transition-all duration-500 ease-in-out sm:m-4 sm:max-w-sm"
            )}>
            <div>
              {surveyHeading}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
