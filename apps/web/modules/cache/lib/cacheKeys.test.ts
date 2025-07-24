import { describe, expect, test } from "vitest";
import { createCacheKey, parseCacheKey, validateCacheKey } from "./cacheKeys";

describe("cacheKeys", () => {
  describe("createCacheKey", () => {
    describe("environment keys", () => {
      test("should create environment state key", () => {
        const key = createCacheKey.environment.state("env123");
        expect(key).toBe("fb:env:env123:state");
      });

      test("should create environment surveys key", () => {
        const key = createCacheKey.environment.surveys("env456");
        expect(key).toBe("fb:env:env456:surveys");
      });

      test("should create environment actionClasses key", () => {
        const key = createCacheKey.environment.actionClasses("env789");
        expect(key).toBe("fb:env:env789:action_classes");
      });

      test("should create environment config key", () => {
        const key = createCacheKey.environment.config("env101");
        expect(key).toBe("fb:env:env101:config");
      });

      test("should create environment segments key", () => {
        const key = createCacheKey.environment.segments("env202");
        expect(key).toBe("fb:env:env202:segments");
      });
    });

    describe("organization keys", () => {
      test("should create organization billing key", () => {
        const key = createCacheKey.organization.billing("org123");
        expect(key).toBe("fb:org:org123:billing");
      });

      test("should create organization environments key", () => {
        const key = createCacheKey.organization.environments("org456");
        expect(key).toBe("fb:org:org456:environments");
      });

      test("should create organization config key", () => {
        const key = createCacheKey.organization.config("org789");
        expect(key).toBe("fb:org:org789:config");
      });

      test("should create organization limits key", () => {
        const key = createCacheKey.organization.limits("org101");
        expect(key).toBe("fb:org:org101:limits");
      });
    });

    describe("license keys", () => {
      test("should create license status key", () => {
        const key = createCacheKey.license.status("org123");
        expect(key).toBe("fb:license:org123:status");
      });

      test("should create license features key", () => {
        const key = createCacheKey.license.features("org456");
        expect(key).toBe("fb:license:org456:features");
      });

      test("should create license usage key", () => {
        const key = createCacheKey.license.usage("org789");
        expect(key).toBe("fb:license:org789:usage");
      });

      test("should create license check key", () => {
        const key = createCacheKey.license.check("org123", "feature-x");
        expect(key).toBe("fb:license:org123:check:feature-x");
      });

      test("should create license previous_result key", () => {
        const key = createCacheKey.license.previous_result("org456");
        expect(key).toBe("fb:license:org456:previous_result");
      });
    });

    describe("user keys", () => {
      test("should create user profile key", () => {
        const key = createCacheKey.user.profile("user123");
        expect(key).toBe("fb:user:user123:profile");
      });

      test("should create user preferences key", () => {
        const key = createCacheKey.user.preferences("user456");
        expect(key).toBe("fb:user:user456:preferences");
      });

      test("should create user organizations key", () => {
        const key = createCacheKey.user.organizations("user789");
        expect(key).toBe("fb:user:user789:organizations");
      });

      test("should create user permissions key", () => {
        const key = createCacheKey.user.permissions("user123", "org456");
        expect(key).toBe("fb:user:user123:org:org456:permissions");
      });
    });

    describe("project keys", () => {
      test("should create project config key", () => {
        const key = createCacheKey.project.config("proj123");
        expect(key).toBe("fb:project:proj123:config");
      });

      test("should create project environments key", () => {
        const key = createCacheKey.project.environments("proj456");
        expect(key).toBe("fb:project:proj456:environments");
      });

      test("should create project surveys key", () => {
        const key = createCacheKey.project.surveys("proj789");
        expect(key).toBe("fb:project:proj789:surveys");
      });
    });

    describe("survey keys", () => {
      test("should create survey metadata key", () => {
        const key = createCacheKey.survey.metadata("survey123");
        expect(key).toBe("fb:survey:survey123:metadata");
      });

      test("should create survey responses key", () => {
        const key = createCacheKey.survey.responses("survey456");
        expect(key).toBe("fb:survey:survey456:responses");
      });

      test("should create survey stats key", () => {
        const key = createCacheKey.survey.stats("survey789");
        expect(key).toBe("fb:survey:survey789:stats");
      });
    });

    describe("session keys", () => {
      test("should create session data key", () => {
        const key = createCacheKey.session.data("session123");
        expect(key).toBe("fb:session:session123:data");
      });

      test("should create session permissions key", () => {
        const key = createCacheKey.session.permissions("session456");
        expect(key).toBe("fb:session:session456:permissions");
      });
    });

    describe("rate limit keys", () => {
      test("should create rate limit api key", () => {
        const key = createCacheKey.rateLimit.api("api-key-123", "endpoint-v1");
        expect(key).toBe("fb:rate_limit:api:api-key-123:endpoint-v1");
      });

      test("should create rate limit login key", () => {
        const key = createCacheKey.rateLimit.login("user-ip-hash");
        expect(key).toBe("fb:rate_limit:login:user-ip-hash");
      });

      test("should create rate limit core key", () => {
        const key = createCacheKey.rateLimit.core("auth:login", "user123", 1703174400);
        expect(key).toBe("fb:rate_limit:auth:login:user123:1703174400");
      });
    });

    describe("custom keys", () => {
      test("should create custom key without subResource", () => {
        const key = createCacheKey.custom("temp", "identifier123");
        expect(key).toBe("fb:temp:identifier123");
      });

      test("should create custom key with subResource", () => {
        const key = createCacheKey.custom("analytics", "user456", "daily-stats");
        expect(key).toBe("fb:analytics:user456:daily-stats");
      });

      test("should work with all valid namespaces", () => {
        const validNamespaces = ["temp", "analytics", "webhook", "integration", "backup"];

        validNamespaces.forEach((namespace) => {
          const key = createCacheKey.custom(namespace, "test-id");
          expect(key).toBe(`fb:${namespace}:test-id`);
        });
      });

      test("should throw error for invalid namespace", () => {
        expect(() => createCacheKey.custom("invalid", "identifier")).toThrow(
          "Invalid cache namespace: invalid. Use: temp, analytics, webhook, integration, backup"
        );
      });

      test("should throw error for empty namespace", () => {
        expect(() => createCacheKey.custom("", "identifier")).toThrow(
          "Invalid cache namespace: . Use: temp, analytics, webhook, integration, backup"
        );
      });
    });
  });

  describe("validateCacheKey", () => {
    test("should validate correct cache keys", () => {
      const validKeys = [
        "fb:env:env123:state",
        "fb:user:user456:profile",
        "fb:org:org789:billing",
        "fb:rate_limit:api:key123:endpoint",
        "fb:custom:namespace:identifier:sub:resource",
      ];

      validKeys.forEach((key) => {
        expect(validateCacheKey(key)).toBe(true);
      });
    });

    test("should reject keys without fb prefix", () => {
      const invalidKeys = ["env:env123:state", "user:user456:profile", "redis:key:value", "cache:item:data"];

      invalidKeys.forEach((key) => {
        expect(validateCacheKey(key)).toBe(false);
      });
    });

    test("should reject keys with insufficient parts", () => {
      const invalidKeys = ["fb:", "fb:env", "fb:env:", "fb:user:user123:"];

      invalidKeys.forEach((key) => {
        expect(validateCacheKey(key)).toBe(false);
      });
    });

    test("should reject keys with empty parts", () => {
      const invalidKeys = ["fb::env123:state", "fb:env::state", "fb:env:env123:", "fb:user::profile"];

      invalidKeys.forEach((key) => {
        expect(validateCacheKey(key)).toBe(false);
      });
    });

    test("should validate minimum valid key", () => {
      expect(validateCacheKey("fb:a:b")).toBe(true);
    });
  });

  describe("parseCacheKey", () => {
    test("should parse basic cache key", () => {
      const result = parseCacheKey("fb:env:env123:state");

      expect(result).toEqual({
        prefix: "fb",
        resource: "env",
        identifier: "env123",
        subResource: "state",
        full: "fb:env:env123:state",
      });
    });

    test("should parse key without subResource", () => {
      const result = parseCacheKey("fb:user:user123");

      expect(result).toEqual({
        prefix: "fb",
        resource: "user",
        identifier: "user123",
        subResource: undefined,
        full: "fb:user:user123",
      });
    });

    test("should parse key with multiple subResource parts", () => {
      const result = parseCacheKey("fb:user:user123:org:org456:permissions");

      expect(result).toEqual({
        prefix: "fb",
        resource: "user",
        identifier: "user123",
        subResource: "org:org456:permissions",
        full: "fb:user:user123:org:org456:permissions",
      });
    });

    test("should parse rate limit key with timestamp", () => {
      const result = parseCacheKey("fb:rate_limit:auth:login:user123:1703174400");

      expect(result).toEqual({
        prefix: "fb",
        resource: "rate_limit",
        identifier: "auth",
        subResource: "login:user123:1703174400",
        full: "fb:rate_limit:auth:login:user123:1703174400",
      });
    });

    test("should throw error for invalid cache key", () => {
      const invalidKeys = ["invalid:key:format", "fb:env", "fb::env123:state", "redis:user:profile"];

      invalidKeys.forEach((key) => {
        expect(() => parseCacheKey(key)).toThrow(`Invalid cache key format: ${key}`);
      });
    });
  });

  describe("cache key patterns and consistency", () => {
    test("all environment keys should follow same pattern", () => {
      const envId = "test-env-123";
      const envKeys = [
        createCacheKey.environment.state(envId),
        createCacheKey.environment.surveys(envId),
        createCacheKey.environment.actionClasses(envId),
        createCacheKey.environment.config(envId),
        createCacheKey.environment.segments(envId),
      ];

      envKeys.forEach((key) => {
        expect(key).toMatch(/^fb:env:test-env-123:.+$/);
        expect(validateCacheKey(key)).toBe(true);
      });
    });

    test("all organization keys should follow same pattern", () => {
      const orgId = "test-org-456";
      const orgKeys = [
        createCacheKey.organization.billing(orgId),
        createCacheKey.organization.environments(orgId),
        createCacheKey.organization.config(orgId),
        createCacheKey.organization.limits(orgId),
      ];

      orgKeys.forEach((key) => {
        expect(key).toMatch(/^fb:org:test-org-456:.+$/);
        expect(validateCacheKey(key)).toBe(true);
      });
    });

    test("all generated keys should be parseable", () => {
      const testKeys = [
        createCacheKey.environment.state("env123"),
        createCacheKey.user.profile("user456"),
        createCacheKey.organization.billing("org789"),
        createCacheKey.survey.metadata("survey101"),
        createCacheKey.session.data("session202"),
        createCacheKey.rateLimit.core("auth:login", "user303", 1703174400),
        createCacheKey.custom("temp", "temp404", "cleanup"),
      ];

      testKeys.forEach((key) => {
        expect(() => parseCacheKey(key)).not.toThrow();

        const parsed = parseCacheKey(key);
        expect(parsed.prefix).toBe("fb");
        expect(parsed.full).toBe(key);
        expect(parsed.resource).toBeTruthy();
        expect(parsed.identifier).toBeTruthy();
      });
    });

    test("keys should be unique across different resources", () => {
      const keys = [
        createCacheKey.environment.state("same-id"),
        createCacheKey.user.profile("same-id"),
        createCacheKey.organization.billing("same-id"),
        createCacheKey.project.config("same-id"),
        createCacheKey.survey.metadata("same-id"),
      ];

      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    test("namespace validation should prevent collisions", () => {
      // These should not throw (valid namespaces)
      expect(() => createCacheKey.custom("temp", "id")).not.toThrow();
      expect(() => createCacheKey.custom("analytics", "id")).not.toThrow();

      // These should throw (reserved/invalid namespaces)
      expect(() => createCacheKey.custom("env", "id")).toThrow();
      expect(() => createCacheKey.custom("user", "id")).toThrow();
      expect(() => createCacheKey.custom("org", "id")).toThrow();
    });
  });
});
