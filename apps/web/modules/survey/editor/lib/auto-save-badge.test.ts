import { describe, expect, test } from "vitest";
import { type TAutoSaveBadgeInput, getAutoSaveBadge } from "./auto-save-badge";

const draft: TAutoSaveBadgeInput = {
  isDraft: true,
  isScheduled: false,
  failure: null,
  showSaved: false,
  canSaveManually: true,
};

describe("getAutoSaveBadge", () => {
  test("a published survey says auto-save is disabled, whatever else is set", () => {
    expect(getAutoSaveBadge({ ...draft, isDraft: false, failure: "retrying", showSaved: true })).toEqual({
      tone: "neutral",
      label: "disabled",
      tooltip: "disabled",
      announce: false,
    });
  });

  test("a healthy draft says auto-save is on, and saved right after a save lands", () => {
    expect(getAutoSaveBadge(draft)).toEqual({ tone: "neutral", label: "on", tooltip: "on", announce: false });
    expect(getAutoSaveBadge({ ...draft, showSaved: true })).toEqual({
      tone: "success",
      label: "saved",
      tooltip: "on",
      announce: false,
    });
  });

  test("a failed save outranks a recent success and is announced", () => {
    expect(getAutoSaveBadge({ ...draft, failure: "retrying", showSaved: true })).toEqual({
      tone: "warning",
      label: "failed",
      tooltip: "failedRetryingOrSaveManually",
      announce: true,
    });
  });

  test("the failure tooltip offers a manual save only where the editor has one", () => {
    expect(getAutoSaveBadge({ ...draft, failure: "retrying", canSaveManually: false }).tooltip).toBe(
      "failedRetrying"
    );
  });

  test("once auto-save has stopped (stale deployment) the tooltip promises no retries", () => {
    for (const canSaveManually of [true, false]) {
      expect(getAutoSaveBadge({ ...draft, failure: "stopped", canSaveManually })).toMatchObject({
        label: "failed",
        tooltip: "failedStopped",
        announce: true,
      });
    }
  });

  test("a scheduled draft says auto-save is paused, not on", () => {
    expect(getAutoSaveBadge({ ...draft, isScheduled: true, showSaved: true })).toEqual({
      tone: "neutral",
      label: "paused",
      tooltip: "paused",
      announce: false,
    });
  });

  test("a failure on a scheduled draft says so without promising retries", () => {
    expect(getAutoSaveBadge({ ...draft, isScheduled: true, failure: "retrying" })).toMatchObject({
      label: "failed",
      tooltip: "failedPaused",
      announce: true,
    });
  });
});
