import type { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import {
  CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
  NO_CONTACTS_IN_SEGMENT_ERROR_CODE,
  SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
  getTranslatedPersonalLinkError,
} from "./personal-link-errors";

describe("getTranslatedPersonalLinkError", () => {
  // Identity mock: returns the key it is asked to translate, so we can assert
  // which translation key each error code maps to.
  const t = vi.fn((key: string) => key) as unknown as TFunction;

  test.each([
    [
      SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
      "workspace.surveys.share.personal_links.segment_survey_workspace_mismatch",
    ],
    [CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE, "workspace.contacts.contact_survey_workspace_mismatch"],
    [NO_CONTACTS_IN_SEGMENT_ERROR_CODE, "workspace.surveys.share.personal_links.no_contacts_in_segment"],
  ])("maps error code %s to its localized key", (errorCode, expectedKey) => {
    expect(getTranslatedPersonalLinkError(errorCode, t)).toBe(expectedKey);
  });

  test("passes unknown error codes through untouched without translating", () => {
    const untranslate = vi.fn((key: string) => key) as unknown as TFunction;
    const unknownCode = "Some raw server error message";

    expect(getTranslatedPersonalLinkError(unknownCode, untranslate)).toBe(unknownCode);
    expect(untranslate).not.toHaveBeenCalled();
  });
});
