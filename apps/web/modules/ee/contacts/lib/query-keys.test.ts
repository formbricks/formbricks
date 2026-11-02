import { describe, expect, test } from "vitest";
import { contactQueryKeys } from "./query-keys";

describe("contactQueryKeys", () => {
  const params = [["filter[email][contains]", "acme"]] as const;

  test("every list key sits under the area root, so one invalidation reaches them all", () => {
    for (const key of [
      contactQueryKeys.contactList("ws_1", params),
      contactQueryKeys.attributeKeyList("ws_1", params),
      contactQueryKeys.segmentList("ws_1", null),
    ]) {
      expect(key.slice(0, contactQueryKeys.all.length)).toEqual(contactQueryKeys.all);
    }
  });

  test("lists of different kinds, workspaces or filters never share a key", () => {
    const keys = [
      contactQueryKeys.contactList("ws_1", params),
      contactQueryKeys.contactList("ws_2", params),
      contactQueryKeys.contactList("ws_1", null),
      contactQueryKeys.attributeKeyList("ws_1", params),
      contactQueryKeys.segmentList("ws_1", params),
    ].map((key) => JSON.stringify(key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
