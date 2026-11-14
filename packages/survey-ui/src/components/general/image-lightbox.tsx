import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  /** Image to show enlarged; `null` closes the lightbox */
  imageUrl: string | null;
  /** Text alternative of the image; it also names the dialog */
  alt: string;
  /** Called when the respondent closes the lightbox (close button, Escape, or a click outside the image) */
  onClose: () => void;
  /** Accessible name of the close button */
  closeLabel?: string;
}

/**
 * Shows one image enlarged in a modal dialog.
 *
 * A native `<dialog>` opened with `showModal()`, rendered in place rather than portalled:
 * - the browser puts it in the top layer, so no `overflow`, `transform` or `z-index` of the survey or
 *   the host page can clip it;
 * - the browser makes everything else inert and keeps focus inside it, so screen readers and Tab stay
 *   in the dialog without a JS focus trap;
 * - it stays a DOM descendant of the survey, so the survey's own focus trap (modal surveys) treats focus
 *   inside it as focus inside the survey instead of pulling it back out, and the `#fbjs`-scoped styles,
 *   appearance and custom CSS still apply.
 *
 * Escape is handled here and stopped: the modal survey container closes the whole survey on an Escape
 * that bubbles up to it, and closing the lightbox must not also close the survey.
 */
function ImageLightbox({
  imageUrl,
  alt,
  onClose,
  closeLabel = "Close",
}: Readonly<ImageLightboxProps>): React.JSX.Element | null {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const isOpen = imageUrl !== null;

  // A layout effect, so the dialog is modal before the first paint instead of flashing in place.
  React.useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    // Browsers restore focus to the opener when a modal dialog closes; not all versions do, and the
    // dialog can also unmount while open (the card changes), so restore it explicitly.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // The dialog fills the viewport with a transparent surface, so a click that lands on the dialog
    // itself (not on the image or the button) is a click outside the image and closes it. Keyboard
    // users close it with Escape (handled below) or the close button.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see above
    <dialog
      ref={dialogRef}
      aria-label={alt}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Stopped so the modal survey container, which closes the whole survey on an Escape that
        // bubbles up to it, does not close it too. preventDefault also suppresses the dialog's own
        // `cancel`, so closing goes only through onClose and the parent's state stays authoritative.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-0 m-0 hidden h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-4 open:flex sm:p-8",
        // A literal colour: `::backdrop` only inherits custom properties in recent browsers, so a
        // var()-based colour would leave the overlay transparent in older ones.
        "backdrop:bg-[rgb(0_0_0/0.8)]"
      )}>
      <img src={imageUrl} alt={alt} className="max-h-full max-w-full rounded-md object-contain shadow-lg" />
      <button
        ref={closeButtonRef}
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute end-3 top-3 flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none">
        <X aria-hidden="true" className="size-5" />
      </button>
    </dialog>
  );
}

export { ImageLightbox };
export type { ImageLightboxProps };
