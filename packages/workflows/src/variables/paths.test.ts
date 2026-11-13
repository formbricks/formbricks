import { describe, expect, test } from "vitest";
import { type TWorkflowRunContext } from "./context";
import { parseWorkflowVariablePath, resolveWorkflowVariable } from "./paths";

const context: TWorkflowRunContext = {
  payload: {
    customer: { email: "ana@example.com", tier: 3, tags: ["vip"], address: { city: "Berlin" } },
    items: [{ id: 1 }],
    empty: null,
  },
  response: { data: { q1: "Yes", colors: ["Red", "Blue"], nps: 9 } },
  steps: { http1: { status: 200, body: { id: "abc", list: [1, 2] } }, email1: { messageId: "<m@x>" } },
};

describe("parseWorkflowVariablePath", () => {
  test("accepts the three prefixes", () => {
    expect(parseWorkflowVariablePath("payload.customer.email")).toEqual({
      ok: true,
      source: "payload",
      segments: ["customer", "email"],
    });
    expect(parseWorkflowVariablePath("steps.http1.body.id")).toMatchObject({ ok: true, source: "steps" });
    expect(parseWorkflowVariablePath("response.q1")).toMatchObject({ ok: true, source: "response" });
  });

  test("refuses any other prefix, so later namespaces never meet saved data", () => {
    expect(parseWorkflowVariablePath("run.id")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("item.name")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("q1")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("payload")).toMatchObject({ ok: false });
  });

  test("refuses prototype segments anywhere in the path", () => {
    for (const segment of ["__proto__", "prototype", "constructor"]) {
      expect(parseWorkflowVariablePath(`payload.a.${segment}`)).toMatchObject({ ok: false });
      expect(parseWorkflowVariablePath(`steps.${segment}.body`)).toMatchObject({ ok: false });
    }
  });

  test("refuses empty segments and characters a recall token cannot carry", () => {
    expect(parseWorkflowVariablePath("payload..a")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("payload.a.")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("payload.a/b")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("payload.a b")).toMatchObject({ ok: false });
  });

  test("a response path names exactly one question", () => {
    expect(parseWorkflowVariablePath("response.q1.sub")).toMatchObject({ ok: false });
  });

  test("a step path reads only the step's status or its body", () => {
    expect(parseWorkflowVariablePath("steps.http1.status")).toMatchObject({ ok: true });
    expect(parseWorkflowVariablePath("steps.http1.body")).toMatchObject({ ok: true });
    expect(parseWorkflowVariablePath("steps.http1.body.customer.tier")).toMatchObject({ ok: true });
    expect(parseWorkflowVariablePath("steps.email1.messageId")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("steps.check.branch")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("steps.http1.status.code")).toMatchObject({ ok: false });
    expect(parseWorkflowVariablePath("steps.http1")).toMatchObject({ ok: false });
  });
});

describe("resolveWorkflowVariable", () => {
  test("reads payload, step output and response values", () => {
    expect(resolveWorkflowVariable(context, "payload.customer.email")).toEqual({
      found: true,
      value: "ana@example.com",
    });
    expect(resolveWorkflowVariable(context, "payload.customer.address")).toEqual({
      found: true,
      value: { city: "Berlin" },
    });
    expect(resolveWorkflowVariable(context, "steps.http1.status")).toEqual({ found: true, value: 200 });
    expect(resolveWorkflowVariable(context, "steps.http1.body.id")).toEqual({ found: true, value: "abc" });
    expect(resolveWorkflowVariable(context, "response.nps")).toEqual({ found: true, value: 9 });
  });

  test("a step's other output fields are not Variables", () => {
    expect(resolveWorkflowVariable(context, "steps.email1.messageId")).toEqual({
      found: false,
      reason: "invalid",
    });
  });

  test("a survey list answer keeps its list", () => {
    expect(resolveWorkflowVariable(context, "response.colors")).toEqual({
      found: true,
      value: ["Red", "Blue"],
    });
  });

  test("payload and step paths can't go into or end at a list", () => {
    expect(resolveWorkflowVariable(context, "payload.customer.tags")).toEqual({
      found: false,
      reason: "list",
    });
    expect(resolveWorkflowVariable(context, "payload.items.0.id")).toEqual({ found: false, reason: "list" });
    expect(resolveWorkflowVariable(context, "steps.http1.body.list")).toEqual({
      found: false,
      reason: "list",
    });
  });

  test("missing values, missing namespaces and null are not found", () => {
    expect(resolveWorkflowVariable(context, "payload.customer.phone")).toEqual({
      found: false,
      reason: "missing",
    });
    expect(resolveWorkflowVariable(context, "payload.empty")).toEqual({ found: false, reason: "missing" });
    expect(resolveWorkflowVariable(context, "steps.nope.status")).toEqual({
      found: false,
      reason: "missing",
    });
    expect(resolveWorkflowVariable({ steps: {} }, "payload.a")).toEqual({ found: false, reason: "missing" });
    expect(resolveWorkflowVariable({ steps: {} }, "response.q1")).toEqual({
      found: false,
      reason: "missing",
    });
  });

  test("never reads inherited properties", () => {
    expect(resolveWorkflowVariable(context, "payload.customer.toString")).toEqual({
      found: false,
      reason: "missing",
    });
    expect(resolveWorkflowVariable(context, "payload.customer.__proto__")).toEqual({
      found: false,
      reason: "invalid",
    });
  });
});
