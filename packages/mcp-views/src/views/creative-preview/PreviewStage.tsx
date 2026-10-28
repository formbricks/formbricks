import { useEffect, useRef } from "react";
import { render } from "../../shared/creatives-renderer";
import type { TCreativeView } from "../../shared/creatives-renderer";
import { useElementWidth } from "../../shared/use-element-width";
import { DEVICE_FRAMES, type TDevice, getScaledSize } from "./geometry";

interface PreviewStageProps {
  view: TCreativeView;
  device: TDevice;
  appearance: "light" | "dark";
  onPress: () => void;
  onDismiss: () => void;
}

/** Grey bars standing in for a site's content: clearly a placeholder, never mistaken for a real page. */
const PlaceholderContent = ({ device }: Readonly<{ device: TDevice }>) => (
  <div className="cp-body" aria-hidden="true">
    <div className="cp-nav">
      <span className="cp-bar cp-logo" />
      <span className="cp-nav-links">
        <span className="cp-bar" />
        <span className="cp-bar" />
        <span className="cp-bar" />
      </span>
    </div>
    <div className="cp-hero">
      <span className="cp-bar cp-h1" />
      <span className="cp-bar cp-h1 cp-h1-short" />
      <span className="cp-bar cp-line" />
      <span className="cp-bar cp-line cp-line-short" />
      <span className="cp-bar cp-cta" />
    </div>
    <div className="cp-cards" data-device={device}>
      <span className="cp-card" />
      <span className="cp-card" />
      <span className="cp-card" />
    </div>
  </div>
);

/**
 * The mock page with the creative drawn on it by the SDK's own renderer. The page is laid out at a fixed
 * device width and scaled to the space available. Its `transform` also makes it the containing block of
 * the creative's `position: fixed` parts, so a feedback tab or an overlay banner sticks to the mock page
 * and not to the chat window around it.
 */
export const PreviewStage = ({
  view,
  device,
  appearance,
  onPress,
  onDismiss,
}: Readonly<PreviewStageProps>) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const available = useElementWidth(wrapRef);
  const { scale, width, height } = getScaledSize(device, available);
  const frame = DEVICE_FRAMES[device];

  useEffect(() => {
    const root = mountRef.current;
    if (!root) return;
    const host = render(view, { root, device, appearance, onClick: onPress, onDismiss });
    return () => host.remove();
  }, [view, device, appearance, onPress, onDismiss]);

  return (
    <div className="cp-stage" data-appearance={appearance}>
      {/* Measured inside the stage's border, so the page is scaled to the width it can really use. */}
      <div ref={wrapRef}>
        <div className="cp-chrome" aria-hidden="true">
          <span className="cp-dot" />
          <span className="cp-dot" />
          <span className="cp-dot" />
          <span className="cp-url">example.com/pricing</span>
        </div>
        <div className="cp-viewport" style={{ width, height }}>
          <div
            className="cp-page"
            data-appearance={appearance}
            data-device={device}
            style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {/* The renderer owns what goes in here, so React never manages its children. */}
            <div className="cp-slot" ref={mountRef} />
            <PlaceholderContent device={device} />
          </div>
        </div>
      </div>
    </div>
  );
};
