import { type MutableRef, useEffect } from "preact/hooks";
import { ensureLiveRegion } from "@/lib/live-region";

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
 * do with rendering the container.
 */
export const useNoOverlayModal = ({
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
