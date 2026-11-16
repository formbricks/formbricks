import { describe, expect, test } from "vitest";
import { responseTopicConditionsClash, ruleAddsResponseTopicClash } from "./response-topic-filters";

const TOPIC = "FeedbackRecords.responseTopic";
const SUBTOPIC = "FeedbackRecords.responseSubtopic";
const is = (...values: string[]) => ({ member: TOPIC, operator: "equals", values });
const negative = { member: "FeedbackRecords.sentiment", operator: "equals", values: ["negative"] };

describe("responseTopicConditionsClash", () => {
  test("lets one condition through, with any number of topics", () => {
    expect(responseTopicConditionsClash([])).toBe(false);
    expect(responseTopicConditionsClash(undefined)).toBe(false);
    expect(responseTopicConditionsClash([is("Billing", "Login")])).toBe(false);
  });

  test("refuses two ANDed conditions whose topic lists do not nest", () => {
    expect(responseTopicConditionsClash([is("Payments"), is("Login")])).toBe(true);
    // Overlapping is not enough: a response mentioning Billing and Shipping passes both, no single row does.
    expect(responseTopicConditionsClash([is("Billing", "Login"), is("Login", "Shipping")])).toBe(true);
    // An `and` group is ANDed like the top level.
    expect(responseTopicConditionsClash([{ and: [is("Payments"), negative, is("Login")] }])).toBe(true);
  });

  test("lets conditions through when one's topics are within every other's", () => {
    expect(responseTopicConditionsClash([is("Payments"), is("Payments")])).toBe(false);
    expect(responseTopicConditionsClash([is("Payments", "Login"), is("Payments")])).toBe(false);
    expect(
      responseTopicConditionsClash([is("Billing", "Login"), is("Billing", "Shipping"), is("Billing")])
    ).toBe(false);
  });

  test("refuses a Response topic and a Response subtopic condition together: they read the same rows", () => {
    const subtopic = { member: SUBTOPIC, operator: "equals", values: ["Billing › Refunds"] };
    expect(responseTopicConditionsClash([is("Billing"), subtopic])).toBe(true);
  });

  test("lets an `or` group through alone, and refuses it ANDed with another condition", () => {
    const either = { or: [is("Payments"), is("Login")] };
    expect(responseTopicConditionsClash([either])).toBe(false);
    expect(responseTopicConditionsClash([{ or: [is("Payments"), negative] }, is("Login")])).toBe(true);
    expect(responseTopicConditionsClash([either, is("Payments")])).toBe(true);
    // An `or` group without a topic condition is no condition on the topics.
    expect(responseTopicConditionsClash([{ or: [negative, negative] }, is("Login")])).toBe(false);
    // A clash inside an `or` branch is a clash.
    expect(responseTopicConditionsClash([{ or: [{ and: [is("Payments"), is("Login")] }, negative] }])).toBe(
      true
    );
  });

  test("never counts set and notSet, or conditions on other fields", () => {
    const set = { member: TOPIC, operator: "set" };
    const notSet = { member: SUBTOPIC, operator: "notSet" };
    expect(responseTopicConditionsClash([is("Payments"), set, notSet, negative])).toBe(false);
    expect(
      responseTopicConditionsClash([
        { member: "FeedbackRecords.topic", operator: "equals", values: ["Payments"] },
        { member: "FeedbackRecords.topic", operator: "equals", values: ["Login"] },
      ])
    ).toBe(false);
  });

  test("reads a stored query defensively", () => {
    expect(responseTopicConditionsClash([null, "x", 3, { member: TOPIC, values: "Payments" }])).toBe(false);
  });
});

describe("ruleAddsResponseTopicClash", () => {
  test("is true only when the rule makes conditions clash that did not", () => {
    expect(ruleAddsResponseTopicClash([is("Payments")], is("Login"))).toBe(true);
    expect(ruleAddsResponseTopicClash([is("Payments")], is("Payments"))).toBe(false);
    expect(ruleAddsResponseTopicClash([], is("Login"))).toBe(false);
    // Conditions that clash already are not this rule's doing.
    expect(ruleAddsResponseTopicClash([is("Payments"), is("Login")], negative)).toBe(false);
  });
});
