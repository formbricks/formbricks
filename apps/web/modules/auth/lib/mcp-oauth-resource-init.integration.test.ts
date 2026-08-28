import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { jwt } from "better-auth/plugins";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { getMcpOauthProviderOptions } from "./mcp-oauth-provider-options";
import { getAuthIssuerUrl, getMcpResourceUrl } from "./oauth-urls";

const BASE_URL = "http://localhost:3000";

const createAuthInstance = (database = prismaAdapter(prisma, { provider: "postgresql" })) =>
  betterAuth({
    baseURL: BASE_URL,
    secret: "mcp-oauth-resource-init-test-secret-0123456789abcdef",
    database,
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwt: { issuer: getAuthIssuerUrl(), audience: getMcpResourceUrl() },
      }),
      oauthProvider(getMcpOauthProviderOptions()),
    ],
  });

const registerMcpClient = (auth: ReturnType<typeof createAuthInstance>) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "MCP OAuth resource init test",
        redirect_uris: ["https://client.example/callback"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        scope: "surveys:read",
      }),
    })
  );

beforeEach(async () => {
  await resetDb();
  await prisma.oauthResource.deleteMany();
});

describe("MCP OAuth resource initialization (real Postgres)", () => {
  test("does not poison auth after an eager seed failure and retries on first resource access", async () => {
    const createAdapter = prismaAdapter(prisma, { provider: "postgresql" });
    let rejectNextResourceLookup = true;
    const database: typeof createAdapter = (options) => {
      const adapter = createAdapter(options);
      return new Proxy(adapter, {
        get(target, property, receiver) {
          if (property !== "findOne") return Reflect.get(target, property, receiver);

          return async (...args: Parameters<typeof target.findOne>) => {
            const [query] = args;
            if (rejectNextResourceLookup && query.model === "oauthResource") {
              rejectNextResourceLookup = false;
              throw Object.assign(new Error("simulated transient database timeout"), { code: "P1001" });
            }
            return target.findOne(...args);
          };
        },
      });
    };
    const auth = createAuthInstance(database);

    await expect(auth.$context).resolves.toBeDefined();
    expect(await prisma.oauthResource.count()).toBe(0);

    const response = await registerMcpClient(auth);

    expect(response.status).toBeLessThan(300);
    expect(await prisma.oauthResource.count()).toBe(1);
  });

  test("initializes concurrent instances against an empty resource table", async () => {
    const instances = Array.from({ length: 6 }, () => createAuthInstance());

    await expect(Promise.all(instances.map((instance) => instance.$context))).resolves.toHaveLength(6);
    expect(await prisma.oauthResource.count()).toBe(1);
  });
});
