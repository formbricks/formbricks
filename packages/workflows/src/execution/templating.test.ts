import { describe, expect, test } from "vitest";
import type { TWorkflowTriggerRunPayload } from "../types/runs";
import { resolvePlaceholders } from "./templating";

const triggerPayload: TWorkflowTriggerRunPayload = {
  type: "response.completed",
  workspaceId: "cm9zr4wsp000508l8y6nh9r2v",
  surveyId: "cm9zr4mps000008l8btfy1vtz",
  responseId: "cm9zr4rsp000708l8bqccpfrx",
  endingCardId: "cm9zr4q7i000108l84gozfggr",
  data: {
    response: {
      email: "jane@example.com",
      score: 9,
      consent: true,
      meta: { source: "web" },
    },
  },
  triggeredAt: "2026-06-09T12:01:00.000Z",
};

describe("resolvePlaceholders", () => {
  test("resolves a response.* placeholder against triggerPayload.data.response", () => {
    expect(resolvePlaceholders("{{response.email}}", triggerPayload)).toBe("jane@example.com");
  });

  test("coerces numbers and booleans to strings", () => {
    expect(resolvePlaceholders("Score: {{response.score}}", triggerPayload)).toBe("Score: 9");
    expect(resolvePlaceholders("{{response.consent}}", triggerPayload)).toBe("true");
  });

  test("tolerates surrounding whitespace in the placeholder", () => {
    expect(resolvePlaceholders("{{  response.email  }}", triggerPayload)).toBe("jane@example.com");
  });

  test("resolves multiple placeholders in one template", () => {
    expect(resolvePlaceholders("Hi {{response.email}}, score {{response.score}}", triggerPayload)).toBe(
      "Hi jane@example.com, score 9"
    );
  });

  test("JSON-encodes object values", () => {
    expect(resolvePlaceholders("{{response.meta}}", triggerPayload)).toBe('{"source":"web"}');
  });

  test("collapses a missing path to the empty-string fallback by default", () => {
    expect(resolvePlaceholders("to={{response.missing}}", triggerPayload)).toBe("to=");
  });

  test("uses a provided fallback for missing paths", () => {
    expect(resolvePlaceholders("{{response.missing}}", triggerPayload, { fallback: "n/a" })).toBe("n/a");
  });

  test("resolves non-response paths against the payload root", () => {
    expect(resolvePlaceholders("{{surveyId}}", triggerPayload)).toBe("cm9zr4mps000008l8btfy1vtz");
  });

  test("returns templates without placeholders unchanged", () => {
    expect(resolvePlaceholders("static subject", triggerPayload)).toBe("static subject");
  });

  test("leaves an empty placeholder untouched", () => {
    expect(resolvePlaceholders("a{{}}b", triggerPayload)).toBe("a{{}}b");
  });

  test("treats an absent data map as empty", () => {
    const payload: TWorkflowTriggerRunPayload = { ...triggerPayload, data: undefined };
    expect(resolvePlaceholders("{{response.email}}", payload)).toBe("");
  });

  test("applies transform to resolved values only, leaving the author template intact", () => {
    const payload: TWorkflowTriggerRunPayload = {
      ...triggerPayload,
      data: { response: { email: "<b>jane</b> & co" } },
    };
    expect(
      resolvePlaceholders("<p>Hi {{response.email}}</p>", payload, { transform: (v) => v.toUpperCase() })
    ).toBe("<p>Hi <B>JANE</B> & CO</p>");
  });
});
