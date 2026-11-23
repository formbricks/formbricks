import { describe, expect, test } from "vitest";
import { type TWorkflowRunContext } from "./context";
import { WorkflowTemplateError } from "./insert";
import { findWorkflowUrlTemplateIssue, isWorkflowUrlPathPosition, renderWorkflowUrlPath } from "./url-path";

const token = (path: string, fallback = "") => `#recall:${path}/fallback:${fallback}#`;
const ID = token("payload.id");
const BASE = "https://api.example.com/customers/";

const withId = (id: unknown): TWorkflowRunContext => ({ payload: { id }, steps: {} });
const render = (id: unknown, template = `${BASE}${ID}/orders`) => renderWorkflowUrlPath(template, withId(id));

describe("isWorkflowUrlPathPosition", () => {
  test("is true only once the path has started and before a query or fragment", () => {
    expect(isWorkflowUrlPathPosition("https://api.example.com/")).toBe(true);
    expect(isWorkflowUrlPathPosition("https://api.example.com:8443/v1/customers/")).toBe(true);
    expect(isWorkflowUrlPathPosition(`https://api.example.com/v1/${ID}/`)).toBe(true);

    expect(isWorkflowUrlPathPosition("")).toBe(false);
    expect(isWorkflowUrlPathPosition("https://")).toBe(false);
    expect(isWorkflowUrlPathPosition("https://api.")).toBe(false);
    expect(isWorkflowUrlPathPosition("https://api.example.com")).toBe(false);
    expect(isWorkflowUrlPathPosition("https://api.example.com:")).toBe(false);
    expect(isWorkflowUrlPathPosition("https://api.example.com/v1?id=")).toBe(false);
    expect(isWorkflowUrlPathPosition("https://api.example.com/v1#")).toBe(false);
    expect(isWorkflowUrlPathPosition("api.example.com/v1/")).toBe(false);
  });
});

describe("findWorkflowUrlTemplateIssue", () => {
  test("accepts a URL without Variables and one with Variables in the path", () => {
    expect(findWorkflowUrlTemplateIssue("https://api.example.com/customers?x=1#top")).toBeNull();
    expect(
      findWorkflowUrlTemplateIssue(`${BASE}${ID}/orders/${token("steps.http1.body.id")}.json`)
    ).toBeNull();
  });

  test("refuses a Variable in the scheme, host or port", () => {
    expect(findWorkflowUrlTemplateIssue(`https://${ID}/customers`)).toBe("variable_before_path");
    expect(findWorkflowUrlTemplateIssue(`https://api.${ID}.com/customers`)).toBe("variable_before_path");
    expect(findWorkflowUrlTemplateIssue(`https://api.example.com:${ID}/x`)).toBe("variable_before_path");
    expect(findWorkflowUrlTemplateIssue(`https://api.example.com${ID}`)).toBe("variable_before_path");
    expect(findWorkflowUrlTemplateIssue(`${ID}/customers`)).toBe("variable_before_path");
  });

  test("refuses a Variable in the query or fragment", () => {
    expect(findWorkflowUrlTemplateIssue(`${BASE}?id=${ID}`)).toBe("variable_after_path");
    expect(findWorkflowUrlTemplateIssue(`${BASE}#${ID}`)).toBe("variable_after_path");
  });

  test("refuses a recall token that is not a Variable", () => {
    expect(findWorkflowUrlTemplateIssue(`${BASE}${token("q1")}`)).toBe("not_a_variable");
    expect(findWorkflowUrlTemplateIssue(`${BASE}#recall:payload.id/fallback:`)).toBe("not_a_variable");
  });
});

describe("renderWorkflowUrlPath", () => {
  test("inserts each value as one encoded path segment", () => {
    expect(render("cus_42")).toBe("https://api.example.com/customers/cus_42/orders");
    expect(render(42)).toBe("https://api.example.com/customers/42/orders");
    expect(render("Zoë Müller")).toBe("https://api.example.com/customers/Zo%C3%AB%20M%C3%BCller/orders");
  });

  test("returns a URL without Variables as written", () => {
    expect(renderWorkflowUrlPath("https://api.example.com/a?b=1#c", withId("x"))).toBe(
      "https://api.example.com/a?b=1#c"
    );
  });

  test("uses the fallback when the value is missing", () => {
    expect(renderWorkflowUrlPath(`${BASE}${token("payload.nope", "unknown")}`, withId("x"))).toBe(
      `${BASE}unknown`
    );
  });

  // Each attack must stay inside its one segment, or fail the step.
  test.each([
    ["a/b", "a%2Fb"],
    ["?x=1", "%3Fx%3D1"],
    ["#frag", "%23frag"],
    ["a\\b", "a%5Cb"],
    ["../admin", "..%2Fadmin"],
    ["@evil.com", "%40evil.com"],
    ["//evil.com", "%2F%2Fevil.com"],
    ["evil.com:443@x", "evil.com%3A443%40x"],
    ["%2F..%2F", "%252F..%252F"],
  ])("keeps %j in one segment", (value, segment) => {
    const url = render(value);
    expect(url).toBe(`https://api.example.com/customers/${segment}/orders`);
    expect(new URL(url).host).toBe("api.example.com");
    expect(new URL(url).pathname.split("/")).toHaveLength(4);
    expect(new URL(url).search).toBe("");
    expect(new URL(url).hash).toBe("");
  });

  test.each([".", "..", "%2e", "%2e%2e", "%2E.", ".%2e", "%252e%252e", "", "  "])(
    "fails the step for %j",
    (value) => {
      expect(() => render(value)).toThrow(WorkflowTemplateError);
    }
  );

  test("fails the step for a missing value with an empty fallback, naming the Variable", () => {
    expect(() => renderWorkflowUrlPath(`${BASE}${token("payload.nope")}`, withId("x"))).toThrow(
      "The URL path Variable payload.nope is empty"
    );
  });

  test("a value that tries to change the host never does", () => {
    // The host is fixed text; anything inserted after the first `/` is path.
    expect(new URL(renderWorkflowUrlPath(`https://api.example.com/${ID}`, withId("@evil.com"))).host).toBe(
      "api.example.com"
    );
    expect(new URL(renderWorkflowUrlPath(`https://api.example.com/${ID}`, withId("//evil.com"))).host).toBe(
      "api.example.com"
    );
  });

  test("refuses a template whose Variables are outside the path", () => {
    expect(() => renderWorkflowUrlPath(`https://${ID}/x`, withId("evil.com"))).toThrow(WorkflowTemplateError);
    expect(() => renderWorkflowUrlPath(`${BASE}?id=${ID}`, withId("1"))).toThrow(WorkflowTemplateError);
  });

  test("fails when the filled-in URL is over 2 KB", () => {
    expect(() => render("a".repeat(2100))).toThrow("at most 2048 bytes");
  });
});
