import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { sendPasswordResetLinkEmail } from "@/modules/email";
import { forgotPasswordAction } from "./actions";

/**
 * ENG-3257 at the ACTION boundary: real `forgotPasswordAction` → real `getUserByEmail` → real Postgres
 * → real Better Auth, with only the mailer captured.
 *
 * This has to be an integration test. The defect is two lookups disagreeing across a framework
 * boundary — our Prisma `findFirst` on a case-sensitive Postgres `text` column versus Better Auth's
 * internal `email.toLowerCase()` — and a mocked `getUserByEmail` returns whatever the test says it
 * does, which is how a unit suite watched this ship. The only thing that can fail on it is a real
 * database with a real row in it.
 *
 * The action is enumeration-safe by design (ENG-670): it answers `{ success: true }` whether or not it
 * found anybody. So the response is worthless as an assertion here — every test below asserts on
 * whether a reset mail was actually produced.
 */

// No Next request scope under vitest; the action reads headers for rate limiting and for Better Auth.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

/**
 * Pin the two flags the action gates on instead of inheriting them from the loaded `.env`. Both
 * default to a value that makes this suite vacuous — `PASSWORD_RESET_DISABLED` short-circuits the
 * action before the lookup, and `EMAIL_AUTH_ENABLED=false` closes the second arm of
 * `canResetPassword` — so without this the tests pass or fail on whatever the developer's env
 * happens to say rather than on the code.
 */
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  PASSWORD_RESET_DISABLED: false,
  EMAIL_AUTH_ENABLED: true,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>();
  return { ...actual, queueAuditEventBackground: vi.fn(async () => undefined) };
});

const STORED_EMAIL = "alice@corporate-example.com";
const PASSWORD = "Passw0rd!";

/** The address as a user would plausibly type it: same account, different shift key. */
const TYPED_WITH_CAPITALS = "Alice@Corporate-Example.com";

/** Recipients of every reset mail produced since the last reset, in call order. */
const resetMailRecipients = (): string[] =>
  vi.mocked(sendPasswordResetLinkEmail).mock.calls.map((call) => call[0].email);

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.mocked(sendPasswordResetLinkEmail).mockResolvedValue(true);

  // Create the account through Better Auth itself rather than a raw Prisma insert: it is what writes
  // the lowercased email and the credential `Account` row that `canResetPassword` gates on, and using
  // it means the row under test is stored exactly as production stores it.
  await auth.api.signUpEmail({ body: { email: STORED_EMAIL, password: PASSWORD, name: "Alice" } });
});

describe("forgotPasswordAction with a differently-capitalised email (real Postgres + Better Auth)", () => {
  test("sends the reset mail for an address typed with capitals", async () => {
    const result = await forgotPasswordAction({ email: TYPED_WITH_CAPITALS });

    expect(result?.data).toEqual({ success: true });
    // Addressed to the STORED form: the lookup normalizes to find the row, then hands Better Auth the
    // address it has on file, which is the one Better Auth's own lowercasing lookup will match.
    expect(resetMailRecipients()).toEqual([STORED_EMAIL]);
  });

  test("still sends for the address typed exactly as stored", async () => {
    // The control. Without it, a fix that broke the ordinary path would leave the test above passing
    // for the wrong reason.
    const result = await forgotPasswordAction({ email: STORED_EMAIL });

    expect(result?.data).toEqual({ success: true });
    expect(resetMailRecipients()).toEqual([STORED_EMAIL]);
  });

  test("sends nothing for an address that belongs to no account", async () => {
    // The silent-skip branch is correct behaviour and must survive the fix — normalizing the lookup
    // must not turn "no such user" into a send, and the response must stay indistinguishable.
    const result = await forgotPasswordAction({ email: "Nobody@corporate-example.com" });

    expect(result?.data).toEqual({ success: true });
    expect(resetMailRecipients()).toEqual([]);
  });
});

describe("getUserByEmail canonicalizes at the query (real Postgres)", () => {
  /**
   * The guard for the next caller, asserted on the lookup rather than on any one action. ENG-1548 was
   * this same defect fixed at the call sites it knew about, and `forgotPasswordAction` — added later —
   * simply never got the `.toLowerCase()`. A test that only drives forgot-password would have watched
   * that happen again. This one fails the moment the normalization leaves the query, whoever calls it.
   */
  test.each([
    ["all caps", STORED_EMAIL.toUpperCase()],
    ["alternating case local part", "aLiCe@corporate-example.com"],
    ["mixed case domain", "alice@Corporate-Example.COM"],
  ])("finds the stored user from an address in %s", async (_label, typed) => {
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: STORED_EMAIL } });

    const found = await getUserByEmail(typed);

    expect(found?.id).toBe(stored.id);
    expect(found?.email).toBe(STORED_EMAIL);
  });
});
