import { describe, expect, test } from "vitest";
import {
  getFeedbackRecordsHubPathname,
  normalizeFeedbackRecordsPath,
} from "@/modules/hub/feedback-records-routing";

describe("feedback records routing", () => {
  test.each([
    ["/api/v3/feedbackRecords", "/"],
    ["/api/v3/feedbackRecords/", "/"],
    ["/api/v3/feedbackRecords/record_1", "/record_1"],
    ["/v1/feedback-records", "/"],
    ["/v1/feedback-records/search/semantic", "/search/semantic"],
  ])("normalizes %s", (pathname, expected) => {
    expect(normalizeFeedbackRecordsPath(pathname)).toBe(expected);
  });

  test.each([
    ["/api/v3/feedbackRecords", "/v1/feedback-records"],
    ["/api/v3/feedbackRecords/", "/v1/feedback-records/"],
    ["/api/v3/feedbackRecords/record_1/similar", "/v1/feedback-records/record_1/similar"],
    ["/v1/feedback-records", "/v1/feedback-records"],
    ["/v1/feedback-records/record_1", "/v1/feedback-records/record_1"],
  ])("maps %s to the Hub pathname", (pathname, expected) => {
    expect(getFeedbackRecordsHubPathname(pathname)).toBe(expected);
  });

  test.each([
    "/api/v3/feedbackRecordsFoo",
    "/v1/feedback-records-other",
    "/api/v3/other",
    "/feedback-records",
  ])("does not match %s", (pathname) => {
    expect(normalizeFeedbackRecordsPath(pathname)).toBeNull();
    expect(getFeedbackRecordsHubPathname(pathname)).toBeNull();
  });
});
