import { describe, expect, test } from "vitest";
import { planBulkMemberAttributeRows } from "./bulk";
import type { TEmailMatch } from "./service";

const keyIdByKey = new Map([
  ["country", "key_country"],
  ["city", "key_city"],
]);

const matches = new Map<string, TEmailMatch>([
  ["anna@example.com", { target: "member", userId: "user_anna", email: "anna@example.com" }],
  ["ben@example.com", { target: "invite", inviteIds: ["inv_1", "inv_2"], email: "ben@example.com" }],
]);

describe("planBulkMemberAttributeRows", () => {
  test("matches a member by email ignoring case and spaces, and replaces only the keys named", () => {
    const { outcomes, writes } = planBulkMemberAttributeRows({
      rows: [{ email: "  Anna@Example.com ", attributes: { country: ["Sweden", "sweden", "Norway"] } }],
      keyIdByKey,
      matches,
    });
    expect(outcomes).toEqual([
      { index: 0, email: "anna@example.com", status: "updated_member", userId: "user_anna" },
    ]);
    expect(writes).toEqual([
      {
        target: "member",
        userId: "user_anna",
        valuesByKeyId: new Map([["key_country", ["Sweden", "Norway"]]]),
      },
    ]);
  });

  test("writes every pending invite to an email that names no member", () => {
    const { outcomes, writes } = planBulkMemberAttributeRows({
      rows: [{ email: "ben@example.com", attributes: { city: [] } }],
      keyIdByKey,
      matches,
    });
    expect(outcomes[0]).toMatchObject({ status: "updated_invite", inviteIds: ["inv_1", "inv_2"] });
    expect(writes.map((write) => write.target === "invite" && write.inviteId)).toEqual(["inv_1", "inv_2"]);
    // An empty list clears the key.
    expect(writes[0].valuesByKeyId.get("key_city")).toEqual([]);
  });

  test("reports an unknown email without writing", () => {
    const { outcomes, writes } = planBulkMemberAttributeRows({
      rows: [{ email: "new@example.com", attributes: { country: ["Sweden"] } }],
      keyIdByKey,
      matches,
    });
    expect(outcomes).toEqual([{ index: 0, email: "new@example.com", status: "unknown_email" }]);
    expect(writes).toEqual([]);
  });

  test("refuses the whole row for an unknown key, so a typo never half-applies", () => {
    const { outcomes, writes } = planBulkMemberAttributeRows({
      rows: [{ email: "anna@example.com", attributes: { country: ["Sweden"], contry: ["Norway"] } }],
      keyIdByKey,
      matches,
    });
    expect(outcomes[0]).toMatchObject({
      status: "invalid",
      problems: [{ name: "attributes.contry", code: "invalid_reference" }],
    });
    expect(writes).toEqual([]);
  });

  test("refuses a second row for the same email and keeps the first", () => {
    const { outcomes, writes } = planBulkMemberAttributeRows({
      rows: [
        { email: "anna@example.com", attributes: { country: ["Sweden"] } },
        { email: "ANNA@example.com", attributes: { country: ["Norway"] } },
      ],
      keyIdByKey,
      matches,
    });
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["updated_member", "invalid"]);
    expect(writes).toHaveLength(1);
  });

  test("refuses a row whose values are past a cap", () => {
    const { outcomes } = planBulkMemberAttributeRows({
      rows: [{ email: "anna@example.com", attributes: { country: ["x".repeat(256)] } }],
      keyIdByKey,
      matches,
    });
    expect(outcomes[0]).toMatchObject({
      status: "invalid",
      problems: [{ name: "attributes.country", code: "limit_exceeded" }],
    });
  });
});
