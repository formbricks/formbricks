import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "./render";
import { DEFAULT_CREATIVE_STYLE } from "./style";
import type { TFeedbackButtonView } from "./types";

const feedbackButton = (overrides: Partial<TFeedbackButtonView> = {}): TFeedbackButtonView => ({
  id: "creative-1",
  type: "feedbackButton",
  label: "Feedback",
  icon: null,
  position: { desktop: { edge: "right", offset: 30 }, phone: null },
  style: DEFAULT_CREATIVE_STYLE,
  destination: { type: "survey", surveyId: "survey-1", opensAs: "popup" },
  ...overrides,
});

const shadowOf = (host: HTMLElement | null): ShadowRoot => {
  if (!host?.shadowRoot) throw new Error("expected an open shadow root");
  return host.shadowRoot;
};

const styleText = (host: HTMLElement | null): string =>
  shadowOf(host).querySelector("style")?.textContent ?? "";

/**
 * The declarations for `.fb-creative-button`, outside any media query or inside the phone one. jsdom
 * builds no CSSOM for a style element inside a shadow root, so its text is parsed through the document.
 */
const buttonRule = (host: HTMLElement | null, media?: string): CSSStyleDeclaration => {
  const parser = document.createElement("style");
  parser.textContent = styleText(host);
  document.head.append(parser);
  const rules = Array.from(parser.sheet?.cssRules ?? []);
  parser.remove();
  const scope = media
    ? Array.from(
        rules.find(
          (rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText === media
        )?.cssRules ?? []
      )
    : rules;
  const rule = scope.find(
    (candidate): candidate is CSSStyleRule =>
      candidate instanceof CSSStyleRule && candidate.selectorText === ".fb-creative-button"
  );
  if (!rule) throw new Error(`no .fb-creative-button rule${media ? ` in ${media}` : ""}`);
  return rule.style;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("render", () => {
  test("draws a feedback button into its own shadow root on the page", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });

    expect(host?.isConnected).toBe(true);
    expect(host?.getAttribute("data-formbricks-creative")).toBe("creative-1");
    const button = shadowOf(host).querySelector("button");
    expect(button?.textContent).toBe("Feedback");
    expect(button?.type).toBe("button");
    expect(button?.classList.contains("fb-creative-button")).toBe(true);
  });

  test("starts the shadow root from a full reset so the page's styles don't reach in", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });

    expect(styleText(host)).toMatch(/^:host\s*\{\s*all:\s*initial;?\s*\}/);
  });

  test("sizes everything in px, never in units that follow the host page's root font", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });

    expect(styleText(host)).not.toMatch(/\d(r?em|vw|vh)\b/);
    expect(buttonRule(host).fontSize).toBe("14px");
  });

  test("opens its Destination when pressed", () => {
    const onClick = vi.fn();
    const host = render(feedbackButton(), { onClick });

    shadowOf(host).querySelector("button")?.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("is reachable and visibly focused from the keyboard", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });
    const button = shadowOf(host).querySelector("button");

    button?.focus();

    expect(shadowOf(host).activeElement).toBe(button);
    expect(styleText(host)).toContain(".fb-creative-button:focus-visible");
  });

  test("carries the page's CSP nonce on its style element", () => {
    const host = render(feedbackButton(), { onClick: vi.fn(), nonce: "abc123" });

    expect(shadowOf(host).querySelector("style")?.getAttribute("nonce")).toBe("abc123");
  });

  test("sits on its edge at its offset", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });
    const rule = buttonRule(host);

    expect(rule.position).toBe("fixed");
    expect(rule.right).toBe("0px");
    expect(rule.left).toBe("auto");
    expect(rule.top).toBe("30%");
  });

  test("moves to its phone position below 768 px", () => {
    const host = render(
      feedbackButton({
        position: { desktop: { edge: "right", offset: 30 }, phone: { edge: "bottom", offset: 80 } },
      }),
      { onClick: vi.fn() }
    );
    const phone = buttonRule(host, "(max-width: 767.98px)");

    expect(phone.bottom).toBe("0px");
    expect(phone.left).toBe("80%");
    expect(phone.right).toBe("auto");
    expect(phone.top).toBe("auto");
  });

  test("keeps its desktop position on phones when it has no phone position", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });

    expect(styleText(host)).not.toContain("@media");
  });

  test("renders into the given root", () => {
    const root = document.createElement("section");
    document.body.append(root);

    const host = render(feedbackButton(), { onClick: vi.fn(), root });

    expect(host?.parentElement).toBe(root);
  });
});
