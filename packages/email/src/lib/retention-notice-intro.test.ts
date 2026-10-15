import { describe, expect, test } from "vitest";
import { t } from "./mock-translate";
import { getRetentionNoticeIntro } from "./retention-notice-intro";

const intro = (hasResponseDeletions: boolean, hasArchivedSurveys: boolean) =>
  getRetentionNoticeIntro(t, { organizationName: "Acme", hasResponseDeletions, hasArchivedSurveys });

describe("getRetentionNoticeIntro", () => {
  test("speaks of both policies when the email lists both", () => {
    expect(intro(true, true)).toBe(
      "Acme automatically deletes responses after a set time and archives surveys that haven't been used in a while. The following is due soon:"
    );
  });

  test("speaks only of deleting responses when no survey is to be archived", () => {
    expect(intro(true, false)).toBe(
      "Acme automatically deletes responses after a set time. The following is due soon:"
    );
  });

  test("speaks only of archiving surveys when no response is to be deleted", () => {
    expect(intro(false, true)).toBe(
      "Acme automatically archives surveys that haven't been used in a while. The following is due soon:"
    );
  });
});
