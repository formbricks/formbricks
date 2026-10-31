import { Check, Eraser } from "lucide-react";
import * as React from "react";
import { ElementError, getElementErrorAria } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Input } from "@/components/general/input";
import { loadSignatureFont } from "@/lib/signature/signature-font";
import {
  SIGNATURE_ASPECT_RATIO,
  type SignatureMode,
  type SignatureValue,
  TYPED_NAME_MAX_LENGTH,
  clearSignature,
  getSignatureLayout,
  isSignatureSigned,
  isTypedNameSigned,
  nextSignatureMode,
} from "@/lib/signature/signature-model";
import { type SignaturePad, createSignaturePad } from "@/lib/signature/signature-pad";
import { cn } from "@/lib/utils";

/** The strings the element renders. Defaults are English; the surveys runtime passes translations. */
interface SignatureLabels {
  /** Visible text of the Clear button */
  clear: string;
  /** Visible text of the Draw tab */
  draw: string;
  /** Visible text of the Type tab */
  type: string;
  /** Accessible name of the typed-name input, and its hint on the empty preview */
  typeYourName: string;
  /** Accessible name of the Draw / Type tab list */
  method: string;
  /** Accessible name of the drawing pad */
  padLabel: string;
  /** Hint drawn on an empty pad */
  signHere: string;
  /** Spoken when the element has a signature */
  signed: string;
  /** Spoken when it has none */
  notSigned: string;
  /** Shown instead of the pad when a signature was saved earlier and only its URL is left */
  saved: string;
  /** Shown over the pad while the image uploads */
  uploading: string;
}

const DEFAULT_LABELS: SignatureLabels = {
  clear: "Clear",
  draw: "Draw",
  type: "Type",
  typeYourName: "Type your name",
  method: "Signature method",
  padLabel: "Signature pad. Draw your signature with your finger, a stylus or a mouse.",
  signHere: "Sign here",
  signed: "Signed",
  notSigned: "Not signed",
  saved: "Your signature is saved. Clear it to sign again.",
  uploading: "Uploading…",
};

interface SignatureProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main element or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Base id for the element's controls (tabs, pad panel, name input, status) */
  inputId: string;
  /** What the respondent has drawn and typed so far. Held by the parent so it survives navigation. */
  value: SignatureValue;
  /** Called with the new value on every edit, including Clear. */
  onChange: (value: SignatureValue) => void;
  /** Called after Clear, so the parent can also drop a signature it saved earlier. */
  onClear?: () => void;
  /** Whether the respondent may type their name instead of drawing. When false there are no tabs. */
  allowTypedSignature?: boolean;
  /**
   * A signature was saved earlier and only its stored URL is left (the page was reloaded). The pad
   * shows that state, not the image: the stored file is private and only the survey's owner can open it.
   */
  hasSavedSignature?: boolean;
  /** The signature image is being uploaded: the pad and Clear are locked. */
  isUploading?: boolean;
  /**
   * Where to fetch the typed-signature font from. Requested the first time the respondent opens the
   * Type tab; without it, or if the request fails, typed names are drawn in the system cursive font.
   */
  typedFontUrl?: string;
  /** Replacement strings; any left out keep their English default. */
  labels?: Partial<SignatureLabels>;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Custom label for the required indicator */
  requiredLabel?: string;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the element is disabled */
  disabled?: boolean;
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
  /** Alt text for the image */
  imageAltText?: string;
}

const CONTROL_CLASSES = cn(
  "inline-flex items-center justify-center gap-1.5 border px-3 py-1.5 transition-colors",
  "rounded-input border-input-border bg-input-bg text-input-text font-input-weight",
  "[font-size:var(--fb-input-font-size)]",
  "disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"
);

function Signature({
  elementId,
  headline,
  description,
  inputId,
  value,
  onChange,
  onClear,
  allowTypedSignature = true,
  hasSavedSignature = false,
  isUploading = false,
  typedFontUrl,
  labels,
  required = false,
  requiredLabel,
  errorMessage,
  dir = "auto",
  disabled = false,
  imageUrl,
  videoUrl,
  imageAltText,
}: Readonly<SignatureProps>): React.JSX.Element {
  const text = { ...DEFAULT_LABELS, ...labels };
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const padRef = React.useRef<SignaturePad | null>(null);
  const [clearCount, setClearCount] = React.useState(0);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const padBoxRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<Partial<Record<SignatureMode, HTMLButtonElement | null>>>({});

  // The pad reports strokes from pointer handlers created once; these refs keep them pointed at the latest props.
  const valueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const { showModeToggle, mode, showNameInput } = getSignatureLayout(allowTypedSignature, value.mode);
  const hasSavedOnly = hasSavedSignature && !isSignatureSigned(value);
  const isSigned = isSignatureSigned(value) || hasSavedSignature;
  const hasAnyInput = value.strokes.length > 0 || value.typedName.length > 0 || hasSavedSignature;
  const locked = disabled || isUploading;
  const drawingEnabled = mode === "draw" && !locked && !hasSavedOnly;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = createSignaturePad({
      canvas,
      onStrokesChange: (strokes) => {
        onChangeRef.current({ ...valueRef.current, strokes });
      },
    });
    padRef.current = pad;
    return () => {
      pad.destroy();
      padRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    padRef.current?.setContent({ mode, strokes: value.strokes, typedName: value.typedName });
  }, [mode, value.strokes, value.typedName]);

  React.useEffect(() => {
    padRef.current?.setDrawingEnabled(drawingEnabled);
  }, [drawingEnabled]);

  // The font is requested the first time the Type tab is open, and the preview is repainted once it is in.
  React.useEffect(() => {
    if (mode !== "type" || !typedFontUrl) return;
    let cancelled = false;
    void loadSignatureFont(typedFontUrl).then(() => {
      if (!cancelled) padRef.current?.redraw();
    });
    return () => {
      cancelled = true;
    };
  }, [mode, typedFontUrl]);

  const errorAria = getElementErrorAria(inputId, errorMessage);
  const descriptionId = description ? `${inputId}-description` : undefined;
  const headlineId = `${inputId}-headline`;
  const panelId = `${inputId}-panel`;
  const nameId = `${inputId}-name`;
  const describedBy = [descriptionId, errorAria.ariaDescribedBy].filter(Boolean).join(" ") || undefined;

  const selectMode = (next: SignatureMode): void => {
    if (next !== value.mode) onChange({ ...value, mode: next });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const next = nextSignatureMode(event.key, mode, dir === "rtl" ? "rtl" : "ltr");
    if (!next) return;
    event.preventDefault();
    selectMode(next);
    tabRefs.current[next]?.focus();
  };

  const handleClear = (): void => {
    onChange(clearSignature(value));
    onClear?.();
    setClearCount((count) => count + 1);
  };

  // Clear disables itself (nothing left to clear), which would drop focus to <body>. Once the cleared state
  // has rendered, focus moves to where the respondent carries on: the name input in Type mode, otherwise
  // the active tab, or the pad itself when there are no tabs.
  React.useEffect(() => {
    if (clearCount === 0) return;
    const target =
      mode === "type" && nameRef.current ? nameRef.current : (tabRefs.current[mode] ?? padBoxRef.current);
    target?.focus({ preventScroll: true });
    // Only a Clear press moves focus, not later changes of mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCount]);

  const renderTab = (tabMode: SignatureMode, label: string): React.JSX.Element => {
    const selected = mode === tabMode;
    return (
      <button
        key={tabMode}
        ref={(el) => {
          tabRefs.current[tabMode] = el;
        }}
        type="button"
        role="tab"
        id={`${inputId}-tab-${tabMode}`}
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        onKeyDown={handleTabKeyDown}
        disabled={locked || hasSavedOnly}
        onClick={() => {
          selectMode(tabMode);
        }}
        className={cn(
          CONTROL_CLASSES,
          selected ? "border-brand-readable bg-input-selected-bg font-semibold" : "hover:bg-input-selected-bg"
        )}>
        {label}
      </button>
    );
  };

  const showHint = !isSigned && !hasAnyInput && !isUploading;
  // In Type mode the canvas is only a preview of the name typed below it, and in the saved state it is
  // blank: neither is something to announce.
  const isPadLabelled = mode === "draw" && !hasSavedOnly;
  const statusText = isUploading ? text.uploading : isSigned ? text.signed : text.notSigned;

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      <ElementHeader
        headline={headline}
        description={description}
        descriptionId={descriptionId}
        headlineId={headlineId}
        required={required}
        requiredLabel={requiredLabel}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
        imageAltText={imageAltText}
      />

      <div className="relative" data-element-input>
        <ElementError errorMessage={errorMessage} dir={dir} id={errorAria.errorId} />

        <div role="group" aria-labelledby={headlineId} aria-describedby={describedBy} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {showModeToggle ? (
              <div role="tablist" aria-label={text.method} className="flex items-center gap-1">
                {renderTab("draw", text.draw)}
                {renderTab("type", text.type)}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleClear}
              disabled={locked || !hasAnyInput}
              className={cn(CONTROL_CLASSES, "hover:bg-input-selected-bg")}>
              <Eraser aria-hidden="true" />
              {text.clear}
            </button>
          </div>

          <div
            id={panelId}
            role={showModeToggle ? "tabpanel" : undefined}
            aria-labelledby={showModeToggle ? `${inputId}-tab-${mode}` : undefined}
            className="space-y-2">
            {/* The pad is a fixed white page with near-black ink in every theme: it is what the exported
                PNG looks like, so it must not follow the survey's colours or dark appearance. */}
            <div
              ref={padBoxRef}
              tabIndex={-1}
              className="rounded-input border-input-border relative w-full overflow-hidden border bg-white outline-none"
              style={{ aspectRatio: `${String(SIGNATURE_ASPECT_RATIO)} / 1` }}>
              <canvas
                ref={canvasRef}
                role={isPadLabelled ? "img" : undefined}
                aria-label={isPadLabelled ? text.padLabel : undefined}
                aria-hidden={isPadLabelled ? undefined : true}
                className="absolute inset-0 block h-full w-full touch-none select-none"
                style={{ touchAction: "none", WebkitTouchCallout: "none" }}
                onContextMenu={(event) => {
                  event.preventDefault();
                }}
              />
              {showHint ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
                  {mode === "type" ? text.typeYourName : text.signHere}
                </span>
              ) : null}
              {hasSavedOnly ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white p-4 text-center text-sm text-neutral-700">
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                  <span>{text.saved}</span>
                </div>
              ) : null}
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-medium text-neutral-700 motion-safe:animate-pulse">
                  {text.uploading}
                </div>
              ) : null}
            </div>

            {showNameInput ? (
              <Input
                id={nameId}
                ref={nameRef}
                type="text"
                aria-describedby={describedBy}
                value={value.typedName}
                maxLength={TYPED_NAME_MAX_LENGTH}
                placeholder={text.typeYourName}
                aria-label={text.typeYourName}
                aria-required={required}
                aria-invalid={errorAria.ariaInvalid && !isTypedNameSigned(value.typedName)}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                className="box-border"
                dir={dir}
                disabled={locked || hasSavedOnly}
                onChange={(event) => {
                  onChange({ ...value, typedName: event.target.value });
                }}
              />
            ) : null}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
}

export { Signature, DEFAULT_LABELS as DEFAULT_SIGNATURE_LABELS };
export type { SignatureProps, SignatureLabels };
