import { describe, expect, test } from "vitest";
import { groupContactsByIdentity, pickContactForRow } from "./contact-identity";

const contact = (id: string, attributes: Record<string, string>) => ({
  id,
  attributes: Object.entries(attributes).map(([key, value]) => ({ attributeKey: { key }, value })),
});

describe("groupContactsByIdentity", () => {
  test("groups contacts by their identity value and keeps the read order in each group", () => {
    const oldest = contact("c1", { email: "a@example.com" });
    const other = contact("c2", { email: "b@example.com" });
    const newest = contact("c3", { email: "a@example.com" });

    const groups = groupContactsByIdentity([oldest, other, newest], "email");

    expect(groups.get("a@example.com")?.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(groups.get("b@example.com")?.map((c) => c.id)).toEqual(["c2"]);
  });

  test("matches on externalId for an external-ID directory and ignores email", () => {
    const withExternalId = contact("c1", { externalId: "crm-1", email: "a@example.com" });
    const emailOnly = contact("c2", { email: "a@example.com" });

    const groups = groupContactsByIdentity([withExternalId, emailOnly], "externalId");

    expect([...groups.keys()]).toEqual(["crm-1"]);
    expect(groups.get("crm-1")?.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("pickContactForRow", () => {
  const oldest = contact("oldest", { email: "a@example.com", userId: "u-1" });
  const middle = contact("middle", { email: "a@example.com", userId: "u-2" });
  const newest = contact("newest", { email: "a@example.com" });

  test("picks the contact whose userId matches the row", () => {
    expect(pickContactForRow([oldest, middle, newest], "u-2")?.id).toBe("middle");
  });

  test("picks the oldest contact when no userId matches", () => {
    expect(pickContactForRow([oldest, middle, newest], "u-9")?.id).toBe("oldest");
  });

  test("picks the oldest contact when the row has no userId", () => {
    expect(pickContactForRow([oldest, middle, newest], undefined)?.id).toBe("oldest");
  });

  test("returns undefined when nothing matches", () => {
    expect(pickContactForRow([], "u-1")).toBeUndefined();
  });
});
