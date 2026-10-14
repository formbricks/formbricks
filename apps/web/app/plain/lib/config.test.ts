import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { warnOnPlainChatMisconfiguration } from "./config";

const mocks = vi.hoisted(() => ({
  env: {
    PLAIN_APP_ID: undefined as string | undefined,
    PLAIN_CHAT_HMAC_SECRET: undefined as string | undefined,
  },
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));

describe("warnOnPlainChatMisconfiguration", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
    mocks.env.PLAIN_APP_ID = undefined;
    mocks.env.PLAIN_CHAT_HMAC_SECRET = undefined;
  });

  test("warns when the app id is set without the secret, without leaking the app id", () => {
    mocks.env.PLAIN_APP_ID = "liveChatApp_secretish";
    warnOnPlainChatMisconfiguration();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [message] = vi.mocked(logger.warn).mock.calls[0] as [string];
    expect(message).toContain("PLAIN_CHAT_HMAC_SECRET");
    expect(message).not.toContain("liveChatApp_secretish");
  });

  test("stays silent when the chat is fully configured or not configured at all", () => {
    warnOnPlainChatMisconfiguration();
    mocks.env.PLAIN_APP_ID = "app_1";
    mocks.env.PLAIN_CHAT_HMAC_SECRET = "secret";
    warnOnPlainChatMisconfiguration();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
