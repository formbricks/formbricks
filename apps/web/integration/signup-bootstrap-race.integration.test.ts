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

    // Genuinely concurrent: both are in flight before either has inserted anything, so both can read zero
    // users at the policy check, exactly as two racing HTTP requests would.
    const outcomes = await Promise.allSettled([signUp("first@example.com"), signUp("second@example.com")]);

    expect(await prisma.user.count()).toBe(1);
    const markedUsers = await prisma.user.findMany({
      where: { isBootstrapAdmin: BootstrapAdminMarker.bootstrapAdmin },
      select: { id: true },
    });
    expect(markedUsers).toHaveLength(1);

    // One of the two loses, and which one is genuinely undetermined — the assertion is on the account
    // that exists, not on the winner. How the loser loses is timing too, so it is deliberately not
    // asserted: it rejects when the unique index refuses its insert (FAILED_TO_CREATE_USER) or when the
    // before-hook's count already sees the winner (the policy 403). But when only the backstop's later
    // count sees the winner, its 403 comes out of `createUser`, and with `autoSignIn: false` Better Auth
    // answers that with its generic-duplicate 200 — a fulfilled result carrying a user that was never
    // inserted (ENG-2812). So count the fulfilled result that carries the persisted id, not every one.
    // Once ENG-2812 is fixed, the loser always rejects: assert that the other outcome is rejected again.
    const [admin] = markedUsers;
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value.user.id === admin.id)
    ).toHaveLength(1);
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
