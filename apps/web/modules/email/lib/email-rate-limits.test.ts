import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ZRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import {
  type TEmailRateLimitContext,
  applyEmailRateLimits,
  emailRateLimits,
  getRecipientIdentifier,
} from "./email-rate-limits";
import type { TEmailType } from "./send-email";

const mocks = vi.hoisted(() => {
  // In-memory stand-in for the limiter's two Lua scripts: charge (refuse without counting once the window
  // would overflow) and settle (hand unused units back).
  const store = new Map<string, number>();
  const redis = {
    eval: vi.fn(
      async (script: string, { keys, arguments: args }: { keys: string[]; arguments: string[] }) => {
        const [key] = keys;
        const current = store.get(key) ?? 0;
        if (script.includes("DECRBY")) {
          const released = Math.min(current, Number(args[0]));
          const updated = current - released;
          if (updated === 0) store.delete(key);
          else store.set(key, updated);
          return [updated, released];
        }
        const next = current + Number(args[2]);
        if (next > Number(args[0])) return [next, 0];
        store.set(key, next);
        return [next, 1];
      }
    ),
  };
  return {
    store,
    redis,
    constants: {
      ENCRYPTION_KEY: "a".repeat(64),
      EMAIL_RATE_LIMIT_MULTIPLIER: 1,
      RATE_LIMITING_DISABLED: false,
      SENTRY_DSN: undefined,
    },
  };
});

vi.mock("@/lib/constants", () => mocks.constants);
vi.mock("@/lib/cache", () => ({ cache: { getRedisClient: vi.fn(async () => mocks.redis) } }));
vi.mock("@formbricks/logger", () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const send = (emailType: TEmailType, to: string, context?: TEmailRateLimitContext) =>
  applyEmailRateLimits(emailType, to, context);

const sendTimes = async (
  count: number,
  emailType: TEmailType,
  to: (index: number) => string,
  context: (index: number) => TEmailRateLimitContext = () => ({})
) => {
  for (let index = 0; index < count; index++) {
    await send(emailType, to(index), context(index));
  }
};

const refused = (promise: Promise<void>) => expect(promise).rejects.toBeInstanceOf(TooManyRequestsError);

const countFor = (namespace: string) =>
  [...mocks.store.entries()]
    .filter(([key]) => key.includes(`:${namespace}:`))
    .reduce((total, [, count]) => total + count, 0);

const external = (organizationId: string, actorUserId: string | null = "owner-1") => ({
  organizationId,
  actorUserId,
  externalRecipient: true,
});

describe("emailRateLimits", () => {
  test("every limit is a valid config, and none shares a namespace with the app's other limits", async () => {
    const namespaces = new Set<string>();
    for (const emailType of Object.keys(emailRateLimits) as TEmailType[]) {
      mocks.store.clear();
      await send(emailType, "someone@example.com", external("org-1", "user-1"));
      for (const key of mocks.store.keys()) namespaces.add(key.split(":").slice(2, 5).join(":"));
    }
    const otherNamespaces = new Set(
      Object.values(rateLimitConfigs).flatMap((group) =>
        Object.values(group).map((config) => config.namespace)
      )
    );

    expect(namespaces.size).toBeGreaterThan(0);
    for (const namespace of namespaces) {
      expect(() => ZRateLimitConfig.parse({ interval: 1, allowedPerInterval: 1, namespace })).not.toThrow();
      expect(otherNamespaces.has(namespace)).toBe(false);
    }
  });

  // A per-deployment cap is shared by every tenant: whoever can reach it stops that email for everyone.
  test("puts deployment caps only on email a signed-in user sends to an address they typed", () => {
    const withDeploymentCap = (Object.keys(emailRateLimits) as TEmailType[]).filter(
      (emailType) => emailRateLimits[emailType].deployment
    );
    expect(withDeploymentCap.sort()).toEqual(["email_change_verification", "invite"]);
  });

  // Counting an address across organizations would let any of them block it for the others.
  test("counts a recipient across organizations only for account email", () => {
    const withTotal = (Object.keys(emailRateLimits) as TEmailType[]).filter(
      (emailType) => emailRateLimits[emailType].recipient?.total
    );
    expect(withTotal.sort()).toEqual(
      ["email_verification", "password_reset", "sso_recovery_verification", "sso_sign_in_hint"].sort()
    );
  });
});

describe("applyEmailRateLimits", () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.constants.EMAIL_RATE_LIMIT_MULTIPLIER = 1;
    mocks.constants.RATE_LIMITING_DISABLED = false;
    mocks.constants.ENCRYPTION_KEY = "a".repeat(64);
    vi.mocked(logger.warn).mockClear();
  });

  describe("fresh resources do not reset a limit", () => {
    test("a survey owner's external email counts across every organization they own", async () => {
      // 200 follow-ups spread over 50 organizations, each far below its own cap.
      await sendTimes(
        200,
        "survey_follow_up",
        (index) => `respondent-${index}@example.com`,
        (index) => external(`org-${index % 50}`, "spammer")
      );

      await refused(send("survey_follow_up", "fresh@example.com", external("brand-new-org", "spammer")));
      await expect(
        send("survey_follow_up", "fresh@example.com", external("brand-new-org", "someone-else"))
      ).resolves.toBeUndefined();
    });

    test("an organization's external email counts across every owner in it", async () => {
      await sendTimes(
        200,
        "workflow_email",
        (index) => `respondent-${index}@example.com`,
        (index) => external("org-1", `owner-${index % 100}`)
      );

      await refused(send("workflow_email", "x@example.com", external("org-1", "new-owner")));
    });

    // Otherwise one owner gets 200 an hour per type, three times over.
    test("follow-ups, workflow emails and verified links share one budget", async () => {
      await sendTimes(
        70,
        "survey_follow_up",
        (index) => `a-${index}@example.com`,
        () => external("org-1")
      );
      await sendTimes(
        70,
        "workflow_email",
        (index) => `b-${index}@example.com`,
        () => external("org-1")
      );
      await sendTimes(
        60,
        "verified_survey_link",
        (index) => `c-${index}@example.com`,
        () => external("org-1")
      );

      await refused(send("verified_survey_link", "d@example.com", external("org-1")));
    });
  });

  describe("email to the organization's own members", () => {
    // Respondents trigger these; letting them spend the budget would stop the organization's mail to itself.
    test("is not counted for follow-ups and workflow emails", async () => {
      await sendTimes(
        300,
        "survey_follow_up",
        () => "team@example.com",
        () => ({
          organizationId: "org-1",
          actorUserId: "owner-1",
          externalRecipient: false,
        })
      );

      expect(mocks.store.size).toBe(0);
      await expect(
        send("survey_follow_up", "respondent@example.com", external("org-1"))
      ).resolves.toBeUndefined();
    });
  });

  describe("recipient caps", () => {
    test("stop one organization flooding an inbox, without blocking that person for anyone else", async () => {
      await sendTimes(
        5,
        "verified_survey_link",
        () => "victim@example.com",
        () => external("attacker-org")
      );

      await refused(send("verified_survey_link", "victim@example.com", external("attacker-org")));
      await expect(
        send("verified_survey_link", "victim@example.com", external("real-employer", "owner-2"))
      ).resolves.toBeUndefined();
    });

    test("count each organization separately, so no number of attacker organizations blocks a person", async () => {
      await sendTimes(
        100,
        "verified_survey_link",
        () => "victim@example.com",
        (index) => external(`attacker-${index % 20}`, `attacker-owner-${index % 20}`)
      );

      await expect(
        send("verified_survey_link", "victim@example.com", external("real-employer", "owner-2"))
      ).resolves.toBeUndefined();
    });

    test("count case and surrounding-whitespace variants of an address as one inbox", async () => {
      await sendTimes(
        5,
        "email_verification",
        (index) =>
          ["new@example.com", "New@Example.com", " NEW@example.com ", "new@EXAMPLE.com", "nEw@example.com"][
            index
          ]
      );

      await refused(send("email_verification", "NEW@example.com"));
    });

    test("are not kept for email changes, so a refusal cannot reveal which addresses have accounts", () => {
      expect(emailRateLimits.email_change_verification.recipient).toBeUndefined();
    });
  });

  test("hands every other limit back when one refuses", async () => {
    // Five follow-ups from five owners spend the inbox's per-organization cap; the organization and each
    // owner still have room (organization cap scaled to 10).
    mocks.constants.EMAIL_RATE_LIMIT_MULTIPLIER = 0.05;
    await sendTimes(
      5,
      "survey_follow_up",
      () => "victim@example.com",
      (index) => external("org-1", `owner-${index}`)
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      await refused(send("survey_follow_up", "victim@example.com", external("org-1", "owner-new")));
    }

    // The refused attempts left nothing behind on the organization or on owner-new.
    expect(countFor("email:organization:survey_external")).toBe(5);
    expect(countFor("email:actor:survey_external")).toBe(5);
    await expect(
      send("survey_follow_up", "other@example.com", external("org-1", "owner-new"))
    ).resolves.toBeUndefined();
  });

  test("scales the volume caps by EMAIL_RATE_LIMIT_MULTIPLIER, never a recipient cap", async () => {
    mocks.constants.EMAIL_RATE_LIMIT_MULTIPLIER = 0.2; // survey_preview: actor 10 -> 2
    await sendTimes(
      2,
      "survey_preview",
      (index) => `me-${index}@example.com`,
      () => ({ actorUserId: "user-1" })
    );
    await refused(send("survey_preview", "me-3@example.com", { actorUserId: "user-1" }));

    mocks.store.clear();
    mocks.constants.EMAIL_RATE_LIMIT_MULTIPLIER = 100;
    await sendTimes(5, "email_verification", () => "new@example.com");
    await refused(send("email_verification", "new@example.com"));
  });

  test("refuses to send without the context a type's limits need", async () => {
    await expect(send("response_notification", "member@example.com")).rejects.toThrow(
      "requires an organizationId"
    );
    await expect(send("survey_preview", "me@example.com")).rejects.toThrow("requires an actorUserId");
    await expect(
      send("survey_follow_up", "x@example.com", { organizationId: "org-1", externalRecipient: true })
    ).rejects.toThrow("requires an actorUserId");
    expect(mocks.store.size).toBe(0);
  });

  test("lets every email through when rate limiting is disabled", async () => {
    mocks.constants.RATE_LIMITING_DISABLED = true;

    await sendTimes(10, "email_verification", () => "new@example.com");

    expect(mocks.store.size).toBe(0);
  });

  test("keeps the address out of Redis keys and the suppression log", async () => {
    const address = "jane.doe@example.com";
    await sendTimes(5, "email_verification", () => address);
    await refused(send("email_verification", address));

    for (const key of mocks.store.keys()) {
      expect(key).not.toContain("jane.doe");
    }
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ emailType: "email_verification", scope: "recipient" }),
      "Outbound email suppressed: rate limit reached"
    );
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("jane.doe");
  });

  test("derives the recipient identifier from the server secret", () => {
    const before = getRecipientIdentifier("jane@example.com");
    mocks.constants.ENCRYPTION_KEY = "b".repeat(64);

    expect(getRecipientIdentifier("jane@example.com")).not.toBe(before);
  });
});
