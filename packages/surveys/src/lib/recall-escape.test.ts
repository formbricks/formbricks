// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import { isValidHTML, sanitizeSurveyHtml, stripInlineStyles } from "@/lib/html-utils";
import { replaceRecallInfo } from "./recall";

const PAYLOAD = '<style>body{display:none}</style><a href="https://evil.example">Your session expired</a>';
const render = (html: string) => sanitizeSurveyHtml(stripInlineStyles(html));
const token = "#recall:name/fallback:friend#";

describe("replaceRecallInfo escaping (rich text templates)", () => {
  test("a hostile value in an HTML template stays text, so no attacker markup reaches the page", () => {
    const out = replaceRecallInfo(`<p>Hi ${token}</p>`, { name: PAYLOAD }, {});
    expect(out).not.toContain("<style");
    expect(out).not.toContain("<a ");
    const host = document.createElement("div");
    host.innerHTML = render(out);
    expect(host.querySelector("style, a, img, form")).toBeNull();
    expect(host.textContent).toContain("Your session expired");
  });

  test("a hostile value in a variable is escaped as well", () => {
    const out = replaceRecallInfo(`<p>Hi ${token}</p>`, {}, { name: '<img src=x onerror="alert(1)">' });
    expect(out).toBe("<p>Hi &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
  });

  test("ampersands and quotes in an ordinary value render as typed", () => {
    const out = replaceRecallInfo(`<p>${token}</p>`, { name: `Tom & "Jerry's"` }, {});
    const host = document.createElement("div");
    host.innerHTML = render(out);
    expect(host.textContent).toBe(`Tom & "Jerry's"`);
  });

  test("a fallback stored escaped in the HTML renders as typed, escaped only once", () => {
    const out = replaceRecallInfo(`<p>#recall:none/fallback:R&amp;D &lt;3&gt;#</p>`, {}, {});
    expect(out).toBe("<p>R&amp;D &lt;3&gt;</p>");
    const host = document.createElement("div");
    host.innerHTML = render(out);
    expect(host.textContent).toBe("R&D <3>");
  });
});

describe("replaceRecallInfo with a plain-text template", () => {
  test("keeps the value literal: no entities and no markup", () => {
    const out = replaceRecallInfo(`Hi ${token}`, { name: "Tom & Jerry" }, {});
    expect(out).toBe("Hi Tom & Jerry");
    expect(isValidHTML(out)).toBe(false);
  });

  test("a hostile value cannot turn the plain template into rendered HTML", () => {
    const out = replaceRecallInfo(`Hi ${token}`, { name: PAYLOAD }, {});
    // Headline/Subheader pick their branch with isValidHTML(result) and render it through the sanitiser.
    expect(isValidHTML(out)).toBe(true);
    const host = document.createElement("div");
    host.innerHTML = render(out);
    expect(host.querySelector("style, a")).toBeNull();
    expect(host.textContent).toContain("<style>body{display:none}</style>");
  });

  test("text output mode (redirect URL, button label) substitutes the raw value", () => {
    const out = replaceRecallInfo(
      "https://example.com/?q=#recall:name/fallback:x#",
      { name: "a&b<c" },
      {},
      "en-US",
      "text"
    );
    expect(out).toBe("https://example.com/?q=a&b<c");
  });

  test("text output mode leaves a value in an HTML-looking template unescaped", () => {
    expect(replaceRecallInfo(`<b>${token}</b>`, { name: "a&b" }, {}, "en-US", "text")).toBe("<b>a&b</b>");
  });
});

describe("replaceRecallInfo substitution", () => {
  test("a value that spells a recall token is not expanded again (no hang, no cross-field read)", () => {
    const out = replaceRecallInfo(
      `Hi ${token}`,
      { name: "#recall:name/fallback:#", secret: "hunter2" },
      {},
      "en-US",
      "text"
    );
    expect(out).toBe("Hi #recall:name/fallback:#");
    const other = replaceRecallInfo(
      `Hi ${token}`,
      { name: "#recall:secret/fallback:#", secret: "s3" },
      {},
      "en-US",
      "text"
    );
    expect(other).not.toContain("s3");
  });

  test("replacement patterns in a value are inserted literally", () => {
    expect(replaceRecallInfo(`Hi ${token}`, { name: "$& $1 $$" }, {}, "en-US", "text")).toBe("Hi $& $1 $$");
  });

  test("falls back when the field has no value, and resolves several tokens", () => {
    expect(replaceRecallInfo(`${token} #recall:b/fallback:nbspx#`, { b: "" }, {}, "en-US", "text")).toBe(
      "friend x"
    );
  });

  test("a token inside an attribute cannot break out of it", () => {
    const out = replaceRecallInfo(
      '<p><a href="https://x.test/?q=#recall:name/fallback:#">l</a></p>',
      { name: '"><img src=x>' },
      {}
    );
    expect(out).not.toContain("<img");
  });
});
