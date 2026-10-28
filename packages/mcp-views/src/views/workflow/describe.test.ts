import { describe, expect, test } from "vitest";
import {
  describeAction,
  describeConditionGroup,
  describeTrigger,
  htmlToPreviewText,
  humanizeKey,
  humanizeStepType,
  truncate,
} from "./describe";
import type { WorkflowNode } from "./model";

const node = (partial: Partial<WorkflowNode> & Pick<WorkflowNode, "type">): WorkflowNode => ({
  id: "n",
  config: {},
  ...partial,
});

describe("htmlToPreviewText", () => {
  test("keeps what a recipient reads and drops markup and entities", () => {
    expect(htmlToPreviewText('<p class="x" dir="ltr">Fish &amp; chips</p><p>Second&nbsp;line</p>')).toBe(
      "Fish & chips Second line"
    );
  });

  test("shows an answer the email fills in, with its fallback", () => {
    expect(htmlToPreviewText("<p>Hi #recall:abc123/fallback:there#!</p>")).toBe('Hi [answer, else "there"]!');
    expect(htmlToPreviewText("<p>Hi #recall:abc123/fallback:#!</p>")).toBe("Hi [answer]!");
  });

  test("keeps a visible angle bracket and cuts long text", () => {
    expect(htmlToPreviewText("<p>5 < 6</p>")).toBe("5 < 6");
    expect(htmlToPreviewText(`<p>${"a".repeat(300)}</p>`, 20)).toHaveLength(20);
  });

  test("strips markup in linear time", () => {
    const start = performance.now();
    htmlToPreviewText("<A".repeat(100_000));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe("truncate", () => {
  test("leaves short text alone and ends long text with an ellipsis", () => {
    expect(truncate("  short ", 10)).toBe("short");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("describeConditionGroup", () => {
  test("describes every operator in words, nested groups included", () => {
    const tree = describeConditionGroup({
      id: "root",
      connector: "and",
      conditions: [
        { id: "a", left: { path: "response.email" }, operator: "exists" },
        {
          id: "g",
          connector: "or",
          conditions: [
            { id: "b", left: { path: "response.score" }, operator: "greaterEqual", right: 8 },
            {
              id: "c",
              left: { path: "response.plan" },
              operator: "equals",
              right: { path: "contact.plan", fallback: "free" },
            },
            { id: "d", left: { path: "response.tag" }, operator: "notEquals", right: "vip" },
            { id: "e", left: { path: "response.flag" }, operator: "equals", right: true },
            { id: "f", left: { path: "response.note" }, operator: "equals", right: null },
          ],
        },
      ],
    });

    expect(tree).toEqual({
      kind: "group",
      connector: "and",
      children: [
        { kind: "condition", text: "response.email is present" },
        {
          kind: "group",
          connector: "or",
          children: [
            { kind: "condition", text: "response.score is at least 8" },
            { kind: "condition", text: 'response.plan is contact.plan (else "free")' },
            { kind: "condition", text: 'response.tag is not "vip"' },
            { kind: "condition", text: "response.flag is true" },
            { kind: "condition", text: "response.note is empty" },
          ],
        },
      ],
    });
  });

  test("returns nothing for something that is not a condition and survives absurd nesting", () => {
    expect(describeConditionGroup(undefined)).toBeNull();
    expect(describeConditionGroup({ nope: true })).toBeNull();
    let nested: Record<string, unknown> = { id: "leaf", left: { path: "a" }, operator: "exists" };
    for (let depth = 0; depth < 50; depth += 1)
      nested = { id: `g${depth}`, connector: "and", conditions: [nested] };
    expect(() => describeConditionGroup(nested)).not.toThrow();
  });
});

describe("describeTrigger", () => {
  test("says when it fires and how it is narrowed", () => {
    const trigger = node({
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "survey1", endingCardIds: ["e1", "e2"] },
    });
    expect(describeTrigger(trigger)).toEqual({
      summary: "A survey response is completed",
      details: [
        { label: "Survey", value: "survey1" },
        { label: "Endings", value: "Only 2 chosen endings" },
      ],
    });
  });

  test("copes with a draft trigger that has no survey yet", () => {
    const { details } = describeTrigger(node({ type: "trigger", triggerType: "response.completed" }));
    expect(details).toEqual([
      { label: "Survey", value: "Not chosen yet" },
      { label: "Endings", value: "Any ending" },
    ]);
  });
});

describe("describeAction", () => {
  const email = (config: Record<string, unknown>) =>
    node({ type: "action", actionType: "send_email", config });

  test("names a literal recipient, or the respondent when the recipient is a question id", () => {
    expect(describeAction(email({ to: "team@example.com", subject: "S", body: "<p>B</p>" })).summary).toBe(
      "Send an email to team@example.com"
    );
    expect(describeAction(email({ to: "cm9questionid", subject: "S", body: "<p>B</p>" })).summary).toBe(
      "Send an email to the respondent (from their answer)"
    );
  });

  test("lists what the email carries", () => {
    const { details, missing } = describeAction(
      email({
        to: "a@b.co",
        subject: "Hello",
        body: "<p>Body</p>",
        replyTo: ["r@b.co"],
        attachResponseData: true,
        includeVariables: true,
      })
    );
    expect(missing).toEqual([]);
    expect(details).toEqual([
      { label: "Subject", value: "Hello" },
      { label: "Message", value: "Body" },
      { label: "Replies go to", value: "r@b.co" },
      { label: "Includes", value: "response data, variables" },
    ]);
  });

  test("reports what a draft still lacks, including a body the editor emptied", () => {
    const { missing, summary } = describeAction(email({ to: "", subject: " ", body: "<p><br></p>" }));
    expect(missing).toEqual(["subject", "message", "recipient"]);
    expect(summary).toBe("Send an email to no recipient yet");
  });

  test("does not pretend to understand an action type it does not know", () => {
    expect(describeAction(node({ type: "action", actionType: "post_slack" }))).toEqual({
      summary: "Run post_slack",
      details: [],
      missing: [],
    });
  });
});

describe("humanizers", () => {
  test("turn identifiers into labels", () => {
    expect(humanizeStepType("send_email")).toBe("Send email");
    expect(humanizeStepType("")).toBe("Step");
    expect(humanizeKey("attachResponseData")).toBe("Attach response data");
    expect(humanizeKey("messageId")).toBe("Message id");
  });
});
