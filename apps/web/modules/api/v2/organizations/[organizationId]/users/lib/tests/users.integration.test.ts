import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import type { TUserInput } from "../../types/users";
import { createUser } from "../users";

/**
 * End-to-end (service + real Postgres) smoke test for the ENG-1801 regression: a duplicate-email
 * create must return a 409 `conflict`, NOT a 500. This drives the exact bug path — real
 * `prisma.user.create` → real P2002 from adapter-pg → `isUniqueConstraintError` → conflict — with no
 * mocks, so it also confirms the `instanceof` guard works against a genuinely-thrown error.
 */
beforeEach(async () => {
  await resetDb();
});

describe("createUser duplicate handling vs real Postgres (ENG-1801)", () => {
  test("returns 409 conflict (not 500) on a real duplicate-email unique violation", async () => {
    const org = await prisma.organization.create({ data: { name: "ENG-1801 Org" } });
    const email = "eng1801-service@example.com";

    const first = await createUser({ name: "First", email, role: "owner" } as TUserInput, org.id);
    expect(first.ok).toBe(true);

    const second = await createUser({ name: "Second", email, role: "member" } as TUserInput, org.id);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.type).toBe("conflict");
      expect(second.error.details).toEqual([
        { field: "email", issue: "A user with this email already exists" },
      ]);
    }
  });
});
