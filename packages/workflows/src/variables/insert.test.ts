import { describe, expect, test } from "vitest";
import { type TWorkflowRunContext } from "./context";
import {
  WorkflowTemplateError,
  buildWorkflowQueryString,
  renderWorkflowEmailBody,
  renderWorkflowHeaderValue,
  renderWorkflowJsonBody,
  renderWorkflowText,
} from "./insert";

const context: TWorkflowRunContext = {
  payload: {
    name: "Ana",
    query: "a&b=c d",
    header: "x\r\nX-Injected: 1",
    count: 3,
    vip: true,
    customer: { id: 7, city: "Berlin" },
    quote: 'say "hi"\n',
    tags: ["a"],
    html: "<b>bold</b>",
  },
  response: { data: { colors: ["Red", "Blue"], q1: "Yes" } },
  steps: { http1: { status: 201 } },
};

const token = (path: string, fallback = "") => `#recall:${path}/fallback:${fallback}#`;

describe("renderWorkflowText", () => {
  test("replaces path tokens and leaves bare survey recall tokens alone", () => {
    expect(renderWorkflowText(`Hi ${token("payload.name")} (${token("steps.http1.status")})`, context)).toBe(
      "Hi Ana (201)"
    );
    expect(renderWorkflowText(`Answer ${token("q1")}`, context)).toBe(`Answer ${token("q1")}`);
  });

  test("a missing value uses the fallback, else empty", () => {
    expect(renderWorkflowText(`Hi ${token("payload.nick", "there")}`, context)).toBe("Hi there");
    expect(renderWorkflowText(`Hi ${token("payload.nick")}!`, context)).toBe("Hi !");
  });

  test("a payload list is not supported yet and reads as missing", () => {
    expect(renderWorkflowText(token("payload.tags", "none"), context)).toBe("none");
  });

  test("survey list answers are joined as text, objects as JSON", () => {
    expect(renderWorkflowText(token("response.colors"), context)).toBe("Red, Blue");
    expect(renderWorkflowText(token("payload.customer"), context)).toBe('{"id":7,"city":"Berlin"}');
  });
});

describe("buildWorkflowQueryString", () => {
  test("URL-encodes each parameter value, inserted Variables included", () => {
    expect(
      buildWorkflowQueryString(
        [
          { name: "q", value: token("payload.query") },
          { name: "who", value: `${token("payload.name")} & co` },
        ],
        context
      )
    ).toBe("q=a%26b%3Dc%20d&who=Ana%20%26%20co");
  });
});

describe("renderWorkflowHeaderValue", () => {
  test("strips line breaks so a value can't add a header", () => {
    expect(renderWorkflowHeaderValue(`Bearer ${token("payload.header")}`, context)).toBe(
      "Bearer xX-Injected: 1"
    );
  });

  test("a missing value with no fallback is empty", () => {
    expect(renderWorkflowHeaderValue(token("payload.nope"), context)).toBe("");
  });
});

describe("renderWorkflowJsonBody", () => {
  test("a token that is the whole value keeps its type", () => {
    const body = JSON.stringify({
      count: token("payload.count"),
      vip: token("payload.vip"),
      customer: token("payload.customer"),
      colors: token("response.colors"),
      name: token("payload.name"),
    });
    expect(JSON.parse(renderWorkflowJsonBody(body, context))).toEqual({
      count: 3,
      vip: true,
      customer: { id: 7, city: "Berlin" },
      colors: ["Red", "Blue"],
      name: "Ana",
    });
  });

  test("a token inside a string is escaped text", () => {
    const body = JSON.stringify({
      note: `They said ${token("payload.quote")}`,
      nested: [`#${token("payload.count")}`],
    });
    expect(JSON.parse(renderWorkflowJsonBody(body, context))).toEqual({
      note: 'They said say "hi"\n',
      nested: ["#3"],
    });
  });

  test("a missing whole value uses the fallback, else null", () => {
    const body = JSON.stringify({
      a: token("payload.nope", "n/a"),
      b: token("payload.nope"),
      c: `x${token("payload.nope")}`,
    });
    expect(JSON.parse(renderWorkflowJsonBody(body, context))).toEqual({ a: "n/a", b: null, c: "x" });
  });

  test("keys are never substituted", () => {
    const body = JSON.stringify({ [token("payload.name")]: 1 });
    expect(JSON.parse(renderWorkflowJsonBody(body, context))).toEqual({ [token("payload.name")]: 1 });
  });

  test("a template that is not JSON is refused", () => {
    expect(() => renderWorkflowJsonBody(`{"a": ${token("payload.count")}}`, context)).toThrow(
      WorkflowTemplateError
    );
  });
});

describe("renderWorkflowEmailBody", () => {
  test("escapes inserted values as HTML and hands response tokens to survey recall", () => {
    expect(
      renderWorkflowEmailBody(`<p>${token("payload.html")} ${token("response.q1", "none")}</p>`, context)
    ).toBe(`<p>&lt;b&gt;bold&lt;/b&gt; ${token("q1", "none")}</p>`);
  });
});
