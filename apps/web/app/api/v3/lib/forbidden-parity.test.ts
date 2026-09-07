import { describe, expect, test } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";

/**
 * The 403-never-404 property spans two modules, so a test inside either one cannot pin it.
 *
 * `mapV3ThrownError` renders a thrown `ResourceNotFoundError` as `problemForbidden(requestId, undefined,
 * instance)` — relying on the *default* detail — while every pre-flight rejection passes the same string
 * as a literal (`lib/auth.ts:64,100,107`, `surveys/authorization.ts`, `tags/lib/operations.ts`). Nothing
 * held those two together: reword the default at `response.ts` and the mapped 403 silently stops matching
 * the pre-flight one, which is the existence oracle the rule exists to prevent.
 *
 * Compares whole bodies and header sets, not status codes — two 403s that differ by one word in `detail`
 * are still an oracle.
 */
const wire = async (res: Response) => ({
  status: res.status,
  headers: Object.fromEntries([...res.headers.entries()].sort()),
  body: await res.json(),
});

describe("403 parity between a thrown not-found and a pre-flight rejection", () => {
  const log = { warn: () => undefined, error: () => undefined };
  const ctx = { log, requestId: "req_parity", instance: "/api/v3/things/abc" };

  test("a missing resource is byte-identical to an unauthorized one", async () => {
    const thrown = await wire(mapV3ThrownError(new ResourceNotFoundError("Response", "secret_id"), ctx));
    const preflight = await wire(
      problemForbidden("req_parity", "You are not authorized to access this resource", "/api/v3/things/abc")
    );

    expect(thrown).toStrictEqual(preflight);
  });

  test("an authorization failure is byte-identical too", async () => {
    const authz = await wire(mapV3ThrownError(new AuthorizationError("nope"), ctx));
    const notFound = await wire(mapV3ThrownError(new ResourceNotFoundError("Response", "secret_id"), ctx));

    expect(authz).toStrictEqual(notFound);
  });

  test("the resource id never reaches the body", async () => {
    const raw = await mapV3ThrownError(new ResourceNotFoundError("Response", "secret_id"), ctx).text();

    expect(raw).not.toContain("secret_id");
    expect(raw).not.toContain("Response");
  });
});
