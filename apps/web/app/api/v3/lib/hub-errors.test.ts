import { describe, expect, test, vi } from "vitest";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { EMBEDDINGS_UNAVAILABLE_DETAIL } from "../feedbackRecords/lib/errors";
import { hubErrorToProblemResponse } from "./hub-errors";

vi.mock("server-only", () => ({}));

const requestId = "req_1";
const instance = "/api/v3/feedbackRecords";

/**
 * What is pinned here is what only this module owns: the *bounds* on what a remote service may contribute
 * to our response body, and which upstream statuses may be relayed at all. The per-surface status matrices
 * are exercised end-to-end in the feedback-records and taxonomy operation suites.
 */
describe("hubErrorToProblemResponse", () => {
  const hubError = (status: number, extra: Record<string, unknown> = {}) => ({
    status,
    message: `${status}`,
    detail: `${status}`,
    ...extra,
  });

  test("truncates a relayed 4xx detail so the Hub cannot size our response body", async () => {
    const response = hubErrorToProblemResponse(
      hubError(422, { problemDetail: "x".repeat(5_000) }),
      requestId,
      instance
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.detail).toHaveLength(512);
  });

  test("caps the number of relayed invalid_params", async () => {
    const invalidParams = Array.from({ length: 50 }, (_, i) => ({
      name: `field_${i}`,
      reason: "y".repeat(1_000),
    }));

    const body = await hubErrorToProblemResponse(
      hubError(400, { invalidParams }),
      requestId,
      instance
    ).json();

    expect(body.invalid_params).toHaveLength(20);
    expect(body.invalid_params[0].reason).toHaveLength(512);
    expect(body.invalid_params[0].name).toBe("field_0");
  });

  /**
   * The Hub's tenant is our dataset, and the record serializer already renames the field outward — so a
   * relayed message must not send a caller looking for a `tenant_id` parameter this API does not have. The
   * fixture is the Hub's verbatim duplicate-create 409, captured from a live instance.
   */
  test("renames the Hub's tenant_id to dataset_id in a relayed detail", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(409, {
        problemDetail: "a feedback record with this tenant_id, submission_id, and field_id already exists",
      }),
      requestId,
      instance
    ).json();

    expect(body.detail).toBe(
      "a feedback record with this dataset_id, submission_id, and field_id already exists"
    );
    expect(body.detail).not.toContain("tenant_id");
  });

  /**
   * The rewrite lengthens the string (`dataset_id` is a character longer), so it has to happen before the
   * slice — otherwise the cap this module exists to enforce is quietly exceeded by however many times the
   * Hub said `tenant_id`.
   */
  test("stays within the relay cap even when the rewrite lengthens the text", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(409, { problemDetail: "tenant_id ".repeat(200) }),
      requestId,
      instance
    ).json();

    expect(body.detail.length).toBeLessThanOrEqual(512);
    expect(body.detail).not.toContain("tenant_id");
  });

  test("renames tenant_id in relayed invalid_params too, where the Hub also names fields", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(400, { invalidParams: [{ name: "tenant_id", reason: "tenant_id is required" }] }),
      requestId,
      instance
    ).json();

    expect(body.invalid_params).toEqual([{ name: "dataset_id", reason: "dataset_id is required" }]);
  });

  // Word-bounded, so it renames the term without corrupting text that merely contains it.
  test("leaves lookalike substrings alone", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(422, { problemDetail: "my_tenant_identifier and tenant_ids are unaffected" }),
      requestId,
      instance
    ).json();

    expect(body.detail).toBe("my_tenant_identifier and tenant_ids are unaffected");
  });

  // 5xx bodies can carry upstream internals, so nothing from them is ever echoed — only the status is.
  test("never relays a 5xx problem detail", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(500, { problemDetail: "panic: nil deref at 10.0.0.1" }),
      requestId,
      instance
    ).json();

    expect(body.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });

  // Not "any 4xx": a Hub 401/403 means our own Hub credentials were refused, and a 404 can reveal upstream
  // addressing. Echoing either would describe our infrastructure rather than the caller's request.
  test.each([401, 403, 404])("never relays the detail of a Hub %i", async (status) => {
    const body = await hubErrorToProblemResponse(
      hubError(status, { problemDetail: "invalid api key for tenant-service" }),
      requestId,
      instance
    ).json();

    expect(JSON.stringify(body)).not.toContain("invalid api key");
  });

  test("maps a success-with-no-payload (no error object at all) to a generic 502", async () => {
    const response = hubErrorToProblemResponse(null, requestId, instance);

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("The feedback service is unavailable.");
  });

  // A 503 means embeddings aren't configured — a deployment-level fact no retry fixes, so it must not be
  // folded into the generic "unavailable" 502 that reads as "try again".
  test("maps a 503 to 503 rather than folding it into the generic 502", async () => {
    const response = hubErrorToProblemResponse(hubError(503), requestId, instance);

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("service_unavailable");
  });

  test("uses the caller's wording for a 503 when it knows what is unconfigured", async () => {
    const body = await hubErrorToProblemResponse(hubError(503), requestId, instance, {
      serviceUnavailableDetail: EMBEDDINGS_UNAVAILABLE_DETAIL,
    }).json();

    expect(body.detail).toContain("EMBEDDING_PROVIDER");
  });

  /**
   * The Hub answers 503 for several unrelated unconfigured subsystems, so the default must name none of them:
   * a plain outage on a list or a create would otherwise tell an operator to go configure embeddings.
   */
  test("names no subsystem in a 503 the caller did not explain", async () => {
    const body = await hubErrorToProblemResponse(hubError(503), requestId, instance).json();

    expect(body.detail).not.toContain("EMBEDDING");
    expect(body.detail).not.toMatch(/embedding/i);
    expect(body.detail).toContain("not configured");
  });

  /**
   * "Switched off on this deployment" is a 503, not the 502 an unreachable Hub gets: no retry fixes it, and
   * a self-hoster needs to be told to configure it. Both arrive with status 0 — only the sentinel's message
   * separates a missing `HUB_API_KEY` from a dead socket — so this is checked before the status switch.
   */
  test("maps the not-configured sentinel to 503, not the unreachable-Hub 502", async () => {
    const response = hubErrorToProblemResponse({ ...NO_CONFIG_ERROR }, requestId, instance);

    expect(response.status).toBe(503);
    expect((await response.json()).detail).toBe("The Hub integration is not configured on this deployment.");
  });

  test("keeps a connection failure — status 0, but not the sentinel — a 502", async () => {
    const response = hubErrorToProblemResponse(
      { status: 0, message: "Connection error.", detail: "Connection error." },
      requestId,
      instance
    );

    expect(response.status).toBe(502);
  });

  test("uses the caller's operation wording for the 502 detail", async () => {
    const body = await hubErrorToProblemResponse(hubError(500), requestId, instance, {
      badGatewayDetail: "Failed to load taxonomy run",
    }).json();

    expect(body.detail).toBe("Failed to load taxonomy run");
  });

  /**
   * Only for a caller that has already proven the resource's tenancy — then a 404 is the benign "gone, or
   * never existed", and answering 502 both misreads as a server fault and inflates the 5xx rate.
   */
  test("maps a Hub 404 to 404 when the caller names the resource", async () => {
    const response = hubErrorToProblemResponse(hubError(404), requestId, instance, {
      notFound: { resourceType: "Taxonomy run", resourceId: "run_1" },
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe("not_found");
    expect(body.details).toEqual({ resource_type: "Taxonomy run", resource_id: "run_1" });
  });

  // Without it there is nothing useful to report missing — a create is the case in point.
  test("keeps a Hub 404 a 502 when the caller names no resource", async () => {
    expect(hubErrorToProblemResponse(hubError(404), requestId, instance).status).toBe(502);
  });

  /**
   * The message users actually need on the taxonomy surface — "at least N embedded text feedback records
   * are required" — arrives in `invalid_params`, not `detail`, so relaying `detail` alone recovers nothing
   * (ENG-2253).
   */
  test("relays a 400's invalid_params, where the Hub puts the actionable text", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(400, {
        problemDetail: "One or more request parameters are invalid",
        invalidParams: [
          {
            name: "TaxonomyScope.tenant_id",
            reason: "at least 20 embedded text feedback records are required; found 3",
          },
        ],
      }),
      requestId,
      instance,
      { badGatewayDetail: "Failed to start taxonomy generation" }
    ).json();

    expect(body.status).toBe(400);
    expect(body.invalid_params[0].reason).toContain("at least 20 embedded text feedback records");
    // Renamed on the way out, like every other relayed string: the Hub's tenant is this API's dataset.
    expect(body.invalid_params[0].name).toBe("TaxonomyScope.dataset_id");
  });
});
