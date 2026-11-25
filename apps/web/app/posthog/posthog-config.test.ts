// @vitest-environment jsdom
import posthog, { type CaptureResult } from "posthog-js";
import { describe, expect, test } from "vitest";
import { maskWebhookNetworkRequests } from "./mask-webhook-network-requests";
import { getPostHogConfig } from "./posthog-config";

describe("getPostHogConfig", () => {
  test("masks all recorded text and inputs and blocks the Plain widget", () => {
    const config = getPostHogConfig(false);
    expect(config.session_recording).toMatchObject({
      blockSelector: "iframe[src*='cdn-plain']",
      maskAllInputs: true,
      maskTextSelector: "*",
      maskCapturedNetworkRequestFn: maskWebhookNetworkRequests,
    });
  });

  test("masks autocaptured element text and attributes", () => {
    const config = getPostHogConfig(false);
    expect(config.mask_all_text).toBe(true);
    expect(config.mask_all_element_attributes).toBe(true);
  });

  test("keeps debug tied to development builds", () => {
    expect(getPostHogConfig(true).debug).toBe(true);
    expect(getPostHogConfig(false).debug).toBe(false);
  });
});

describe("autocapture payload with the real posthog-js", () => {
  test("a click on a respondent's email carries no element text or attributes", () => {
    const events: CaptureResult[] = [];
    posthog.init("phc_dummy_test_key", {
      ...getPostHogConfig(false),
      api_host: "http://localhost:1",
      ui_host: undefined,
      autocapture: true,
      disable_session_recording: true,
      capture_exceptions: false,
      advanced_disable_flags: true,
      before_send: (event) => {
        if (event) events.push(event);
        return null;
      },
    });

    document.body.innerHTML = `<button id="x" data-respondent="bob@example.com" title="carol@example.com">alice@example.com</button>`;
    document.getElementById("x")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const autocaptured = events.find((e) => e.event === "$autocapture");
    expect(autocaptured).toBeDefined();
    const serialized = JSON.stringify(autocaptured?.properties);
    expect(serialized).not.toContain("alice@example.com");
    expect(serialized).not.toContain("bob@example.com");
    expect(serialized).not.toContain("carol@example.com");
  });
});
