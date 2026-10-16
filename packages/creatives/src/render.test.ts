import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "./render";
import { DEFAULT_CREATIVE_STYLE } from "./style";
import type { TBannerView, TCreativeStyle, TFeedbackButtonView } from "./types";

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

const shadowOf = (host: HTMLElement): ShadowRoot => {
  if (!host.shadowRoot) throw new Error("expected an open shadow root");
  return host.shadowRoot;
};

const styleText = (host: HTMLElement): string => shadowOf(host).querySelector("style")?.textContent ?? "";

/**
 * The declarations for `.fb-creative-button`, outside any media query or inside the phone one. jsdom
 * builds no CSSOM for a style element inside a shadow root, so its text is parsed through the document.
 */
const buttonRule = (
  host: HTMLElement,
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
const ICON = ".fb-creative-button-icon";

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

    expect(host.isConnected).toBe(true);
    expect(host.getAttribute("data-formbricks-creative")).toBe("creative-1");
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

  test("sits on its edge at its offset, along the part of the edge Overlay banners leave free", () => {
    const host = render(feedbackButton(), { onClick: vi.fn() });
    const rule = buttonRule(host);

    expect(rule.position).toBe("fixed");
    expect(rule.right).toBe("0px");
    expect(rule.left).toBe("auto");
    // 30 % of the way between the top Overlay banners (`--fb-creative-top`) and the bottom ones.
    expect(rule.top).toBe(
      "calc(var(--fb-creative-top,0px) + (100% - var(--fb-creative-top,0px) - var(--fb-creative-bottom,0px)) * 0.3)"
    );
  });

  test("moves to its phone position below 768 px", () => {
    const host = render(
      feedbackButton({
        position: { desktop: { edge: "right", offset: 30 }, phone: { edge: "bottom", offset: 80 } },
      }),
      { onClick: vi.fn() }
    );
    const phone = buttonRule(host, "(max-width: 767.98px)");

    // Above the bottom Overlay banners.
    expect(phone.bottom).toBe("var(--fb-creative-bottom,0px)");
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

    expect(host.parentElement).toBe(root);
  });

  describe("final look (ENG-3578)", () => {
    test("is one real button in the page's tab order, named by its label, with no close control", () => {
      const host = render(feedbackButton({ icon: "sparkles" }), { onClick: vi.fn() });
      const controls = shadowOf(host).querySelectorAll("button, a, [tabindex], [role=button]");
      const button = shadowOf(host).querySelector("button");

      expect(controls).toHaveLength(1);
      expect(button?.tabIndex).toBe(0);
      expect(button?.disabled).toBe(false);
      expect(button?.hasAttribute("aria-label")).toBe(false);
      expect(button?.textContent).toBe("Feedback");
      expect(host.hasAttribute("inert") || host.hasAttribute("aria-hidden")).toBe(false);
    });

    test("draws its icon before the label, hidden from screen readers so the label alone names it", () => {
      const host = render(feedbackButton({ icon: "megaphone" }), { onClick: vi.fn() });
      const button = shadowOf(host).querySelector("button");
      const icon = button?.firstElementChild;

      expect(icon?.tagName.toLowerCase()).toBe("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      // Drawn in the label's colour, so it follows the light and dark palettes and the author's CSS.
      expect(icon?.getAttribute("stroke")).toBe("currentColor");
      expect(button?.textContent).toBe("Feedback");
    });

    test("draws every icon of the editor's set, and none without one", () => {
      for (const icon of ["messageSquare", "messageCircle", "megaphone", "sparkles"] as const) {
        const host = render(feedbackButton({ icon }), { onClick: vi.fn() });
        expect(shadowOf(host).querySelector("svg path")?.getAttribute("d")).toMatch(/^M/);
      }

      const plain = render(feedbackButton({ icon: null }), { onClick: vi.fn() });
      expect(shadowOf(plain).querySelector("svg")).toBeNull();
    });

    test("sizes its icon from the label's font size on each device, as the survey button does", () => {
      // The survey button draws a 16 px icon 8 px from a 14 px label.
      const element = {
        ...STYLE.element,
        desktop: { ...STYLE.element.desktop, fontSize: 14 },
        phone: { ...STYLE.element.phone, fontSize: 21 },
      };
      const host = render(feedbackButton({ icon: "megaphone", style: { ...STYLE, element } }), {
        onClick: vi.fn(),
      });

      expect(buttonRule(host).display).toBe("flex");
      expect(buttonRule(host).alignItems).toBe("center");
      expect(buttonRule(host).gap).toBe("8px");
      expect(buttonRule(host, undefined, ICON).width).toBe("16px");
      expect(buttonRule(host, undefined, ICON).height).toBe("16px");
      expect(buttonRule(host, PHONE).gap).toBe("12px");
      expect(buttonRule(host, PHONE, ICON).width).toBe("24px");
    });

    test("reads bottom to top on a side edge, its icon turned with the label, and level on the bottom edge", () => {
      const host = render(
        feedbackButton({
          icon: "megaphone",
          position: { desktop: { edge: "left", offset: 60 }, phone: { edge: "bottom", offset: 50 } },
        }),
        { onClick: vi.fn() }
      );

      expect(buttonRule(host).writingMode).toBe("vertical-rl");
      expect(buttonRule(host).transform).toBe("translateY(-60%) rotate(180deg)");
      // Upright glyphs turn a quarter clockwise in vertical text; the icon turns with them.
      expect(buttonRule(host, undefined, ICON).transform).toBe("rotate(90deg)");
      expect(buttonRule(host, PHONE).writingMode).toBe("horizontal-tb");
      expect(buttonRule(host, PHONE).transform).toBe("translateX(-50%)");
      expect(buttonRule(host, PHONE, ICON).transform).toBe("none");
    });

    test("shows a focus ring in two of its own colours, so one of them stands out on any page", () => {
      const host = render(feedbackButton({ style: STYLE }), { onClick: vi.fn() });
      const focused = buttonRule(host, undefined, ".fb-creative-button:focus-visible");
      const darkFocused = buttonRule(
        host,
        undefined,
        ".fb-creative-button[data-appearance=dark]:focus-visible"
      );

      // The label colour hugs the button, its background colour rings that.
      expect(focused.boxShadow).toBe("0 0 0 2px #ffffff,0 0 0 4px #0b5394");
      expect(darkFocused.boxShadow).toBe("0 0 0 2px #0f172a,0 0 0 4px #93c5fd");
      // Shadows drop in forced-colors mode, where the transparent outline takes the system colour.
      expect(focused.outline).toBe("2px solid transparent");
    });

    test("fades a little on hover, like the survey button, and a little more while pressed", () => {
      const host = render(feedbackButton(), { onClick: vi.fn() });

      expect(buttonRule(host, undefined, ".fb-creative-button:hover").opacity).toBe("0.9");
      expect(buttonRule(host, undefined, ".fb-creative-button:active").opacity).toBe("0.8");
    });
  });
});

const banner = (overrides: Partial<TBannerView> = {}): TBannerView => ({
  id: "banner-1",
  type: "banner",
  message: [{ text: "Scheduled maintenance tonight." }],
  buttonLabel: null,
  dismissible: false,
  accessibleName: null,
  position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
  style: { ...DEFAULT_CREATIVE_STYLE, button: DEFAULT_CREATIVE_STYLE.element },
  destination: null,
  ...overrides,
});

const barOf = (host: HTMLElement): HTMLElement => {
  const bar = shadowOf(host).querySelector<HTMLElement>(".fb-creative-banner");
  if (!bar) throw new Error("expected a .fb-creative-banner");
  return bar;
};

describe("render a banner (ENG-3576)", () => {
  test("draws a region named Site notice at the top of the page, before the page's own content", () => {
    const pageContent = document.createElement("header");
    document.body.append(pageContent);

    const host = render(banner(), { onClick: vi.fn() });

    expect(document.body.firstElementChild).toBe(host);
    expect(host.getAttribute("data-formbricks-creative")).toBe("banner-1");
    const bar = barOf(host);
    expect(bar.getAttribute("role")).toBe("region");
    expect(bar.getAttribute("aria-label")).toBe("Site notice");
    expect(bar.textContent).toBe("Scheduled maintenance tonight.");
  });

  test("announces the author's Accessible name instead of the default", () => {
    const host = render(banner({ accessibleName: "Open Enrollment" }), { onClick: vi.fn() });

    expect(barOf(host).getAttribute("aria-label")).toBe("Open Enrollment");
  });

  test("goes into the site's banner slot when the page has one", () => {
    const header = document.createElement("header");
    const slot = document.createElement("div");
    slot.setAttribute("data-formbricks-slot", "banner-top");
    header.append(slot);
    document.body.append(header);

    const host = render(banner(), { onClick: vi.fn() });

    expect(host.parentElement).toBe(slot);
  });

  test("goes at the start of the given root, as a preview frame passes it", () => {
    const root = document.createElement("div");
    root.append(document.createElement("main"));
    document.body.append(root);

    const host = render(banner(), { onClick: vi.fn(), root });

    expect(root.firstElementChild).toBe(host);
  });

  test("draws its text runs with their formatting and links, never as markup", () => {
    const host = render(
      banner({
        message: [
          { text: "Open Enrollment ", bold: true },
          { text: "ends ", italic: true },
          { text: "Dec 15", underline: true },
          { text: ". " },
          { text: "See ", href: "/open-enrollment" },
          { text: "plans", href: "/open-enrollment", bold: true },
          { text: "\n<img src=x onerror=alert(1)>" },
        ],
      }),
      { onClick: vi.fn() }
    );
    const bar = barOf(host);

    expect(bar.querySelector("strong")?.textContent).toBe("Open Enrollment ");
    expect(bar.querySelector("em")?.textContent).toBe("ends ");
    expect(bar.querySelector("u")?.textContent).toBe("Dec 15");
    const links = bar.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/open-enrollment");
    expect(links[0].textContent).toBe("See plans");
    expect(links[0].querySelector("strong")?.textContent).toBe("plans");
    expect(bar.querySelector("img")).toBeNull();
    expect(bar.textContent).toContain("\n<img src=x onerror=alert(1)>");
  });

  test("keeps a link with a scheme it doesn't allow as plain text", () => {
    const host = render(banner({ message: [{ text: "Click me", href: "javascript:alert(1)" }] }), {
      onClick: vi.fn(),
    });

    expect(barOf(host).querySelector("a")).toBeNull();
    expect(barOf(host).textContent).toBe("Click me");
  });

  test("opens its Destination from its button", () => {
    const onClick = vi.fn();
    const host = render(
      banner({
        buttonLabel: "Continue",
        destination: { type: "survey", surveyId: "survey-1", opensAs: "popup" },
      }),
      { onClick }
    );
    const button = barOf(host).querySelector("button");

    expect(button?.textContent).toBe("Continue");
    expect(button?.type).toBe("button");
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("is a notice only without a button, and has no dismiss unless the author allows it", () => {
    const host = render(banner(), { onClick: vi.fn() });

    expect(barOf(host).querySelector("button")).toBeNull();
  });

  test("offers a Dismiss control when dismissible, and leaves closing to the caller", () => {
    const onClick = vi.fn();
    const onDismiss = vi.fn();
    const host = render(banner({ dismissible: true }), { onClick, onDismiss });
    const dismiss = barOf(host).querySelector("button");

    expect(dismiss?.getAttribute("aria-label")).toBe("Dismiss");
    expect(dismiss?.type).toBe("button");
    dismiss?.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    expect(host.isConnected).toBe(true);
  });

  test("never takes the focus from where the visitor is", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    render(
      banner({
        buttonLabel: "Continue",
        dismissible: true,
        destination: { type: "link", url: "https://example.com" },
      }),
      {
        onClick: vi.fn(),
      }
    );

    expect(document.activeElement).toBe(input);
  });

  describe("layout", () => {
    const BAR = ".fb-creative-banner";

    test("In page sits in the page flow, full width, from a full reset", () => {
      const host = render(banner(), { onClick: vi.fn() });
      const bar = buttonRule(host, undefined, BAR);

      expect(styleText(host)).toMatch(/^:host\{all:initial;display:block\}/);
      expect(bar.position).toBe("relative");
      expect(bar.display).toBe("flex");
    });

    test("Overlay at the top stays fixed at the top, below newer Overlay banners and under the survey popup", () => {
      const host = render(
        banner({ position: { desktop: { placement: "top", layout: "overlay" }, phone: null } }),
        {
          onClick: vi.fn(),
        }
      );
      const bar = buttonRule(host, undefined, BAR);

      expect(bar.position).toBe("fixed");
      expect(bar.top).toBe("var(--fb-creative-top,0px)");
      expect(bar.bottom).toBe("auto");
      expect(bar.left).toBe("0px");
      expect(bar.right).toBe("0px");
      expect(bar.zIndex).toBe("999998");
    });

    test("a bottom banner is an Overlay fixed at the bottom", () => {
      const host = render(
        banner({ position: { desktop: { placement: "bottom", layout: "overlay" }, phone: null } }),
        { onClick: vi.fn() }
      );
      const bar = buttonRule(host, undefined, BAR);

      expect(bar.position).toBe("fixed");
      expect(bar.top).toBe("auto");
      expect(bar.bottom).toBe("var(--fb-creative-bottom,0px)");
    });

    test("takes its phone placement below 768 px", () => {
      const host = render(
        banner({
          position: {
            desktop: { placement: "top", layout: "inPage" },
            phone: { placement: "bottom", layout: "overlay" },
          },
        }),
        { onClick: vi.fn() }
      );
      const phone = buttonRule(host, PHONE, BAR);

      expect(phone.position).toBe("fixed");
      expect(phone.bottom).toBe("var(--fb-creative-bottom,0px)");
    });

    test("a preview can force the phone placement, with no media query", () => {
      const host = render(
        banner({
          position: {
            desktop: { placement: "top", layout: "inPage" },
            phone: { placement: "bottom", layout: "overlay" },
          },
        }),
        { onClick: vi.fn(), device: "phone" }
      );

      expect(styleText(host)).not.toContain("@media");
      expect(buttonRule(host, undefined, BAR).position).toBe("fixed");
    });

    test("appears in one step: nothing animates", () => {
      const text = styleText(render(banner(), { onClick: vi.fn() }));

      expect(text).not.toMatch(/transition|animation/);
    });
  });

  describe("look", () => {
    const BAR = ".fb-creative-banner";
    const BUTTON = ".fb-creative-banner-button";

    /** The survey card for the bar, the survey button for its button: every value distinct. */
    const BANNER_STYLE: TCreativeStyle = {
      element: {
        light: { backgroundColor: "#fef3c7", textColor: "#111827", borderColor: "#d97706" },
        dark: { backgroundColor: "#1f2937", textColor: "#f9fafb", borderColor: null },
        desktop: { fontSize: 16, paddingX: 24, paddingY: 12 },
        phone: { fontSize: 14, paddingX: 12, paddingY: 8 },
        borderRadius: 0,
        fontWeight: 500,
      },
      button: {
        light: { backgroundColor: "#0b5394", textColor: "#ffffff", borderColor: null },
        dark: { backgroundColor: "#93c5fd", textColor: "#0f172a", borderColor: null },
        desktop: { fontSize: 15, paddingX: 18, paddingY: 9 },
        phone: { fontSize: 13, paddingX: 10, paddingY: 7 },
        borderRadius: 6,
        fontWeight: 600,
      },
      pageFont: false,
      customCss: null,
    };

    const draw = (overrides: Partial<TBannerView> = {}, appearance?: "light" | "dark") =>
      render(
        banner({
          style: BANNER_STYLE,
          buttonLabel: "Continue",
          destination: { type: "link", url: "https://example.com" },
          ...overrides,
        }),
        { onClick: vi.fn(), appearance }
      );

    test("draws the bar in the computed light look, with its border along the edge facing the page", () => {
      const bar = buttonRule(draw(), undefined, BAR);

      expect(bar.color).toBe("rgb(17, 24, 39)");
      expect(bar.background).toBe("rgb(254, 243, 199)");
      expect(bar.borderColor).toBe("rgb(217, 119, 6)");
      expect(bar.borderWidth).toBe("0px 0px 1px");
      expect(bar.fontSize).toBe("16px");
      expect(bar.fontWeight).toBe("500");
      expect(bar.padding).toBe("12px 24px");
    });

    test("a bottom banner draws its border along its top edge", () => {
      const host = draw({ position: { desktop: { placement: "bottom", layout: "overlay" }, phone: null } });

      expect(buttonRule(host, undefined, BAR).borderWidth).toBe("1px 0px 0px");
    });

    test("draws its button as the survey button", () => {
      const button = buttonRule(draw(), undefined, BUTTON);

      expect(button.background).toBe("rgb(11, 83, 148)");
      expect(button.color).toBe("rgb(255, 255, 255)");
      expect(button.borderRadius).toBe("6px");
      expect(button.fontSize).toBe("15px");
      expect(button.fontWeight).toBe("600");
      expect(button.padding).toBe("9px 18px");
    });

    test("switches the bar and its button to their dark colours when the visitor's appearance is dark", () => {
      const host = draw({}, "dark");

      expect(barOf(host).getAttribute("data-appearance")).toBe("dark");
      const bar = buttonRule(host, undefined, `${BAR}[data-appearance=dark]`);
      expect(bar.background).toBe("rgb(31, 41, 55)");
      expect(bar.color).toBe("rgb(249, 250, 251)");
      const button = buttonRule(host, undefined, `${BAR}[data-appearance=dark] ${BUTTON}`);
      expect(button.background).toBe("rgb(147, 197, 253)");
      expect(button.color).toBe("rgb(15, 23, 42)");
    });

    test("uses its phone sizes below 768 px, with 44 px touch targets", () => {
      const host = draw({ dismissible: true });

      expect(buttonRule(host, PHONE, BAR).fontSize).toBe("14px");
      expect(buttonRule(host, PHONE, BAR).padding).toBe("8px 12px");
      expect(buttonRule(host, PHONE, BUTTON).fontSize).toBe("13px");
      expect(buttonRule(host, PHONE, BUTTON).minHeight).toBe("44px");
      expect(buttonRule(host, PHONE, ".fb-creative-banner-dismiss").height).toBe("44px");
      expect(buttonRule(host, PHONE, ".fb-creative-banner-dismiss").width).toBe("44px");
    });

    test("renders in the survey font unless Page font is on", () => {
      expect(buttonRule(draw(), undefined, BAR).fontFamily).toContain("Inter");

      const host = draw({ style: { ...BANNER_STYLE, pageFont: true } });
      expect(styleText(host)).toMatch(/^:host\{all:initial;display:block;font-family:inherit\}/);
      expect(buttonRule(host, undefined, BAR).fontFamily).toBe("inherit");
    });

    test("sizes everything in px, never in units that follow the host page's root font", () => {
      expect(styleText(draw())).not.toMatch(/\d(r?em)\b/);
    });

    test("applies its own CSS last", () => {
      const customCss = {
        light: "@layer fb-survey{.fb-creative-banner{letter-spacing:1px!important}}",
        dark: "@layer fb-survey-dark{.fb-creative-banner[data-appearance=dark]{color:#fff!important}}",
      };

      const text = styleText(draw({ style: { ...BANNER_STYLE, customCss } }));

      expect(text.endsWith(`@layer fb-survey-dark,fb-survey;${customCss.light}${customCss.dark}`)).toBe(true);
    });
  });
});
