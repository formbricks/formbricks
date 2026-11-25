import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { setHeadersInFlight } from "@/integration/next-headers";
import { BASE_URL, signIn as signInForCookie } from "@/integration/oauth-flow";
import { hashSecret } from "@/lib/crypto";
import { createApiKey } from "@/modules/organization/settings/api-keys/lib/api-key";

/**
 * Calls the app's HTTP API the way a client does, without a server: a request built here goes straight
 * into the exported route handler, so authentication, validation, the service and SpiceDB all run as in
 * production. These are the API journeys that used to open Chromium only to mint a key (ENG-7518).
 *
 * Session routes read the caller through `next/headers`, which only Next.js fills. A file that calls one
 * mocks it with `integration/next-headers.ts`, which answers with the headers of the request in flight.
 */

type TRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

export type TRouteResult = {
  status: number;
  headers: Headers;
  // eslint-disable-next-line typescript/no-explicit-any -- the parsed JSON reply; each test asserts the shape it reads
  body: any;
};

export type TRouteRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  /** The route's dynamic segments, as Next.js passes them. */
  params?: Record<string, string>;
  query?: Record<string, string | number>;
  body?: unknown;
  apiKey?: string;
  /** A `Cookie` header from {@link signIn}. Sent with the same-origin marker a browser's `fetch` carries. */
  cookie?: string;
};

export const callRoute = async (handler: unknown, request: TRouteRequest): Promise<TRouteResult> => {
  const url = new URL(request.path, BASE_URL);
  for (const [key, value] of Object.entries(request.query ?? {})) {
    url.searchParams.set(key, String(value));
  }

  const headers = new Headers();
  if (request.apiKey) headers.set("x-api-key", request.apiKey);
  if (request.cookie) {
    headers.set("cookie", request.cookie);
    for (const [name, value] of Object.entries(SAME_ORIGIN_HEADERS)) headers.set(name, value);
  }
  if (request.body !== undefined) headers.set("content-type", "application/json");
  setHeadersInFlight(headers);

  const response = await (handler as TRouteHandler)(
    new NextRequest(url, {
      method: request.method ?? "GET",
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    }),
    { params: Promise.resolve(request.params ?? {}) }
  );

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: hand back the text.
  }
  return { status: response.status, headers: response.headers, body };
};

export type TApiOwner = {
  userId: string;
  email: string;
  password: string;
  organizationId: string;
  workspaceId: string;
};

/**
 * An organization with one workspace, owned by a user who can sign in with a password, and the four
 * default contact attribute keys every new workspace gets. Converges SpiceDB with it before returning.
 */
export const seedOwner = async (name = "owner"): Promise<TApiOwner> => {
  const email = `${name}@example.com`;
  const password = `${name}-Password-1`;
  const hashedPassword = await hashSecret(password, 4);

  const organization = await prisma.organization.create({
    data: {
      name: `${name}'s organization`,
      billing: { create: { limits: { projects: null, monthly: { responses: null, miu: null } } } },
    },
  });
  const workspace = await prisma.workspace.create({
    data: { name: `${name}'s workspace`, organizationId: organization.id },
  });
  await prisma.contactAttributeKey.createMany({
    data: [
      { name: "Email", key: "email", isUnique: true, type: "default", workspaceId: workspace.id },
      { name: "First Name", key: "firstName", isUnique: false, type: "default", workspaceId: workspace.id },
      { name: "Last Name", key: "lastName", isUnique: false, type: "default", workspaceId: workspace.id },
      { name: "userId", key: "userId", isUnique: true, type: "default", workspaceId: workspace.id },
    ],
  });
  const user = await prisma.user.create({
    data: {
      name,
      email,
      // The harness's Prisma client models this as Better Auth's Boolean (integration/db-boolean.ts).
      emailVerified: true,
      locale: "en-US",
      memberships: { create: { organizationId: organization.id, role: "owner" } },
    },
  });
  // Better Auth checks a password against the credential account, keyed by the user id.
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "credential",
      provider: "credential",
      providerAccountId: user.id,
      password: hashedPassword,
    },
  });
  await synchronizeAuthzedIntegrationFixture();

  return { userId: user.id, email, password, organizationId: organization.id, workspaceId: workspace.id };
};

/**
 * The key the settings dialog creates: Manage on the owner's workspace, and read and write on access
 * control. Minted by the real `createApiKey`, so it is stored and projected exactly as in production.
 */
export const createOwnerApiKey = async (owner: TApiOwner): Promise<string> => {
  const { actualKey } = await createApiKey(owner.organizationId, owner.userId, {
    label: "integration",
    workspacePermissions: [{ workspaceId: owner.workspaceId, permission: "manage" }],
    organizationAccess: { accessControl: { read: true, write: true } },
  });
  await synchronizeAuthzedIntegrationFixture();
  return actualKey;
};

/** Signs in through Better Auth and returns the `Cookie` header a browser would then send. */
export const signIn = async (owner: Pick<TApiOwner, "email" | "password">): Promise<string> =>
  (await signInForCookie(owner.email, owner.password)).cookie;
