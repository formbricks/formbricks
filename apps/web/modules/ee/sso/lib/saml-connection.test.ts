import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSamlConnectionExists } from "./saml-connection";
import type { TSsoAvailability } from "./sso-availability";

const mocks = vi.hoisted(() => ({ jackson: vi.fn(), getConnections: vi.fn(), loggerError: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({ default: mocks.jackson }));
vi.mock("@/lib/constants", () => ({ SAML_PRODUCT: "formbricks", SAML_TENANT: "formbricks.com" }));
vi.mock("@formbricks/logger", () => ({ logger: { error: mocks.loggerError } }));

const availability = (saml: boolean): TSsoAvailability => ({
  isSsoEnabled: true,
  providers: { google: false, github: false, azuread: false, openid: false, saml },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.jackson.mockResolvedValue({ connectionController: { getConnections: mocks.getConnections } });
  mocks.getConnections.mockResolvedValue([{ clientID: "one" }]);
});

describe("getSamlConnectionExists", () => {
  test("looks up the instance's connection with the product and tenant the action used", async () => {
    expect(await getSamlConnectionExists(availability(true))).toBe(true);
    expect(mocks.getConnections).toHaveBeenCalledWith({ product: "formbricks", tenant: "formbricks.com" });
  });

  test.each([[[]], [[{ clientID: "one" }, { clientID: "two" }]]])(
    "answers false for anything but exactly one connection (%j)",
    async (connections) => {
      mocks.getConnections.mockResolvedValue(connections);

      expect(await getSamlConnectionExists(availability(true))).toBe(false);
    }
  );

  test("does not start Jackson when the page offers no SAML button", async () => {
    expect(await getSamlConnectionExists(availability(false))).toBe(false);
    expect(mocks.jackson).not.toHaveBeenCalled();
  });

  test("answers false when SAML is not licensed, so Jackson does not start", async () => {
    mocks.jackson.mockResolvedValue(undefined);

    expect(await getSamlConnectionExists(availability(true))).toBe(false);
  });

  test("answers false, and logs, when the lookup fails, so the page still renders", async () => {
    mocks.getConnections.mockRejectedValue(new Error("db down"));

    expect(await getSamlConnectionExists(availability(true))).toBe(false);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
