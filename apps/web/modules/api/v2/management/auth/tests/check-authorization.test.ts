import { describe, expect, it } from "vitest";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { checkAuthorization } from "../check-authorization";

describe("checkAuthorization", () => {
  it("should return ok if authentication is valid", () => {
    const authentication: TAuthenticationApiKey = {
      type: "apiKey",
      environmentId: "env-id",
      hashedApiKey: "hashed-api-key",
    };
    const result = checkAuthorization({ authentication, environmentId: "env-id" });

    expect(result.ok).toBe(true);
  });

  it("should return unauthorized error if environmentId does not match", () => {
    const authentication: TAuthenticationApiKey = {
      type: "apiKey",
      environmentId: "env-id",
      hashedApiKey: "hashed-api-key",
    };
    const result = checkAuthorization({ authentication, environmentId: "different-env-id" });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toEqual({ type: "unauthorized" });
    }
  });
});
