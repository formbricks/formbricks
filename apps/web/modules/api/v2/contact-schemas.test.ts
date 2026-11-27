import { describe, expect, test } from "vitest";
import { ZContact } from "@formbricks/database/zod/contact";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

// These schemas document the v2 API's contact and attribute-key responses, and no v2 response returns a
// row's contact directory (decision 9 keeps `directoryId` out of every pinned public shape).
describe("v2 OpenAPI contact schemas", () => {
  test("the contact schema has no directoryId", () => {
    expect(Object.keys(ZContact.shape)).not.toContain("directoryId");
  });

  test("the contact attribute key schema has no directoryId", () => {
    expect(Object.keys(ZContactAttributeKey.shape)).not.toContain("directoryId");
  });
});
