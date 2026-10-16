import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "./render";
import { DEFAULT_CREATIVE_STYLE } from "./style";
import type { TCreativeStyle, TFeedbackButtonView } from "./types";

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
const buttonRule = (
  host: HTMLElement | null,
  media?: string,
  selector = ".fb-creative-button"
): CSSStyleDeclaration => {
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
      candidate instanceof CSSStyleRule && candidate.selectorText === selector
  );
  if (!rule) throw new Error(`no ${selector} rule${media ? ` in ${media}` : ""}`);
  return rule.style;
};

const PHONE = "(max-width: 767.98px)";
const DARK = ".fb-creative-button[data-appearance=dark]";

/** A look whose every value is distinct, so each assertion can only pass on the right field. */
const STYLE: TCreativeStyle = {
  element: {
    light: { backgroundColor: "#0b5394", textColor: "#ffffff", borderColor: "#000000" },
    dark: { backgroundColor: "#93c5fd", textColor: "#0f172a", borderColor: null },
    desktop: { fontSize: 15, paddingX: 20, paddingY: 10 },
    phone: { fontSize: 13, paddingX: 12, paddingY: 6 },
    borderRadius: 4,
    fontWeight: 600,
  },
  button: null,
  pageFont: false,
  customCss: null,
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

  describe("look (ENG-3998)", () => {
    test("draws the computed light look", () => {
      const rule = buttonRule(render(feedbackButton({ style: STYLE }), { onClick: vi.fn() }));

      expect(rule.color).toBe("rgb(255, 255, 255)");
      expect(rule.background).toBe("rgb(11, 83, 148)");
      expect(rule.border).toBe("1px solid rgb(0, 0, 0)");
      expect(rule.fontSize).toBe("15px");
      expect(rule.fontWeight).toBe("600");
      expect(rule.padding).toBe("20px 10px");
    });

    test("switches to the dark colours when the visitor's appearance is dark", () => {
      const host = render(feedbackButton({ style: STYLE }), { onClick: vi.fn(), appearance: "dark" });
      const dark = buttonRule(host, undefined, DARK);

      expect(shadowOf(host).querySelector("button")?.getAttribute("data-appearance")).toBe("dark");
      expect(dark.background).toBe("rgb(147, 197, 253)");
      expect(dark.color).toBe("rgb(15, 23, 42)");
      expect(dark.border).toMatch(/^0|none/);
    });

    test("stays light by default", () => {
      const host = render(feedbackButton({ style: STYLE }), { onClick: vi.fn() });

      expect(shadowOf(host).querySelector("button")?.getAttribute("data-appearance")).toBe("light");
    });

    test("uses its phone size below 768 px", () => {
      const phone = buttonRule(render(feedbackButton({ style: STYLE }), { onClick: vi.fn() }), PHONE);

      expect(phone.fontSize).toBe("13px");
      expect(phone.padding).toBe("12px 6px");
    });

    test("a preview can force the phone look, with no media query", () => {
      const host = render(
        feedbackButton({
          style: STYLE,
          position: { desktop: { edge: "right", offset: 30 }, phone: { edge: "bottom", offset: 80 } },
        }),
        { onClick: vi.fn(), device: "phone" }
      );
      const rule = buttonRule(host);

      expect(styleText(host)).not.toContain("@media");
      expect(rule.fontSize).toBe("13px");
      expect(rule.left).toBe("80%");
    });

    test("renders in the survey font unless Page font is on", () => {
      const host = render(feedbackButton({ style: STYLE }), { onClick: vi.fn() });

      expect(buttonRule(host).fontFamily).toContain("Inter");
      expect(styleText(host)).not.toContain("font-family:inherit");
    });

    test("inherits the host page's font with Page font on", () => {
      const host = render(feedbackButton({ style: { ...STYLE, pageFont: true } }), { onClick: vi.fn() });

      expect(styleText(host)).toMatch(/^:host\{all:initial;font-family:inherit\}/);
      expect(buttonRule(host).fontFamily).toBe("inherit");
    });

    test("applies its own CSS last, with dark rules ordered to win over light ones", () => {
      const customCss = {
        light: "@layer fb-survey{.fb-creative-button{letter-spacing:1px!important}}",
        dark: "@layer fb-survey-dark{.fb-creative-button[data-appearance=dark]{color:#fff!important}}",
      };
      const text = styleText(
        render(feedbackButton({ style: { ...STYLE, customCss } }), { onClick: vi.fn() })
      );

      expect(text.endsWith(`@layer fb-survey-dark,fb-survey;${customCss.light}${customCss.dark}`)).toBe(true);
    });
  });

  test("renders into the given root", () => {
    const root = document.createElement("section");
    document.body.append(root);

    const host = render(feedbackButton(), { onClick: vi.fn(), root });

    expect(host?.parentElement).toBe(root);
  });
});
