import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { BootstrapAdminMarker } from "@formbricks/database/prisma";
import { SIGNUP_DISABLED_ERROR_CODE } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { SIGNUP_ENABLED } from "@/lib/constants";
import { auth } from "@/modules/auth/lib/auth";

/**
 * ENG-2247, against real Postgres — the only level that can fail on this.
 *
 * A closed instance admits exactly one uninvited account: the initial administrator, who has no invite
 * to present. That exception was a bare `user.count() === 0` read well before the row it gates commits,
 * so two concurrent sign-ups both saw zero and both were admitted.
 *
 * A mocked unit test cannot catch that. The defect is not in what the code decides — each request
 * decides correctly on what it can see — it is that two correct decisions are made against the same
 * stale read. Only a real database, and two requests genuinely in flight at once, can tell the fixed
 * code from the broken code: without the unique index both sign-ups below succeed.
 */
/*
 * Configure this file's instance as CLOSED, before the imports below bind `@/lib/constants`.
 *
 * `SIGNUP_ENABLED` is `IS_FORMBRICKS_CLOUD || IS_DEVELOPMENT || E2E_TESTING`, read once at module load.
 * CI leaves all three unset, but a developer's own `.env` commonly carries `E2E_TESTING=1` — and with
 * public sign-up open there is no fresh-instance exception to race, so this file would quietly assert
 * nothing on their machine while staying green on CI. Set the condition rather than inherit it.
 */
vi.hoisted(() => {
  process.env.IS_FORMBRICKS_CLOUD = "0";
  process.env.E2E_TESTING = "0";
});

const signUp = (email: string) =>
  auth.api.signUpEmail({
    body: { email, password: "Bootstrap-Passw0rd!", name: "Admin" },
    headers: new Headers(),
  });

beforeEach(async () => {
  await resetDb();
});

describe("Fresh-instance sign-up exception (real Postgres)", () => {
  test("two concurrent uninvited sign-ups on a fresh instance create exactly one user", async () => {
    // Guards the hoisted override above: if it ever stops taking effect, this fails here rather than
    // by silently admitting both sign-ups on the open-signup branch.
    expect(SIGNUP_ENABLED).toBe(false);
    expect(await prisma.user.count()).toBe(0);

    // Genuinely concurrent: both reach the policy check, which is a database round trip, before either
    // has inserted anything — so both read zero users, exactly as two racing HTTP requests would.
    const outcomes = await Promise.allSettled([signUp("first@example.com"), signUp("second@example.com")]);

    expect(await prisma.user.count()).toBe(1);
    expect(
      await prisma.user.count({ where: { isBootstrapAdmin: BootstrapAdminMarker.bootstrapAdmin } })
    ).toBe(1);

    // One of the two loses, and which one is genuinely undetermined — the assertion is on the count,
    // not on the winner. The loser's error is Better Auth's generic create failure rather than the
    // policy rejection: a unique-violation out of the adapter is not an APIError, so the sign-up route
    // maps it to FAILED_TO_CREATE_USER. Deliberately not asserted — it is incidental to this fix and
    // would pin an upstream detail. The clean 403 still covers every non-racing rejection, below.
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  test("the exception is single-use: the next uninvited sign-up is rejected by policy", async () => {
    await signUp("admin@example.com");

    // Not the constraint doing this — the instance is no longer fresh, so the ordinary closed-signup
    // gate rejects before anything is created. Pinned here because it is what the marker is protecting:
    // if the race had admitted a second administrator, this is the door that would have been left open.
    await expect(signUp("intruder@example.com")).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: SIGNUP_DISABLED_ERROR_CODE },
    });

    expect(await prisma.user.count()).toBe(1);
  });
});
