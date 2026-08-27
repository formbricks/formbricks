import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  getAIUnavailableAction,
  getAIUnavailableActionLabel,
  getAIUnavailableMessage,
  getAIUnavailableMessageForErrorCode,
} from "./availability";

// Echoing the key back keeps the assertions about *which* string each input resolves to, without
// pinning the English wording.
const t = ((key: string) => key) as unknown as TFunction;

const CLOUD = { isFormbricksCloud: true, enterpriseLicenseRequestFormUrl: "https://forms.example/licence" };
const SELF_HOSTED = {
  isFormbricksCloud: false,
  enterpriseLicenseRequestFormUrl: "https://forms.example/licence",
};

describe("getAIUnavailableAction", () => {
  test("sends people to organization settings when AI is switched off", () => {
    expect(getAIUnavailableAction("not_enabled", "org-1", CLOUD)).toEqual({
      href: "/organizations/org-1/settings/general",
      type: "enable_ai",
      isExternal: false,
    });
  });

  test("the enable action does not depend on the deployment", () => {
    expect(getAIUnavailableAction("not_enabled", "org-1", SELF_HOSTED)).toEqual(
      getAIUnavailableAction("not_enabled", "org-1", CLOUD)
    );
  });

  test("upgrades through billing on cloud", () => {
    expect(getAIUnavailableAction("not_in_plan", "org-1", CLOUD)).toEqual({
      href: "/organizations/org-1/settings/billing",
      type: "upgrade_plan",
      isExternal: false,
    });
  });

  // Self-hosted instances have no billing page to upgrade on: sending them there is a dead end, so
  // the CTA has to become a licence request pointed at the configured form.
  test("upgrades through the licence request form when self-hosted", () => {
    expect(getAIUnavailableAction("not_in_plan", "org-1", SELF_HOSTED)).toEqual({
      href: "https://forms.example/licence",
      type: "request_license",
      isExternal: true,
    });
  });

  test("offers no action for reasons the user cannot resolve themselves", () => {
    expect(getAIUnavailableAction("instance_not_configured", "org-1", CLOUD)).toBeUndefined();
    expect(getAIUnavailableAction("read_only", "org-1", CLOUD)).toBeUndefined();
    expect(getAIUnavailableAction(undefined, "org-1", CLOUD)).toBeUndefined();
  });
});

describe("getAIUnavailableMessage", () => {
  test("resolves one shared message per reason", () => {
    expect(getAIUnavailableMessage("not_in_plan", t)).toBe("common.ai_unavailable.not_in_plan");
    expect(getAIUnavailableMessage("not_enabled", t)).toBe("common.ai_unavailable.not_enabled");
    expect(getAIUnavailableMessage("instance_not_configured", t)).toBe(
      "common.ai_unavailable.instance_not_configured"
    );
    expect(getAIUnavailableMessage("read_only", t)).toBe("common.ai_unavailable.read_only");
  });

  test("falls back to the generic message when the reason is unknown", () => {
    expect(getAIUnavailableMessage(undefined, t)).toBe("common.ai_unavailable.unknown");
  });
});

describe("getAIUnavailableMessageForErrorCode", () => {
  // A request can fail for the same reasons the page-load gate catches, so the two paths must agree
  // rather than each keeping their own wording.
  test("maps the AI-unavailable server codes onto the reason copy", () => {
    expect(getAIUnavailableMessageForErrorCode("ai_features_not_enabled", t)).toBe(
      getAIUnavailableMessage("not_in_plan", t)
    );
    expect(getAIUnavailableMessageForErrorCode("ai_smart_tools_disabled", t)).toBe(
      getAIUnavailableMessage("not_enabled", t)
    );
    expect(getAIUnavailableMessageForErrorCode("ai_instance_not_configured", t)).toBe(
      getAIUnavailableMessage("instance_not_configured", t)
    );
  });

  test("returns undefined for codes the caller must handle itself", () => {
    expect(getAIUnavailableMessageForErrorCode("ai_quota_exceeded", t)).toBeUndefined();
    expect(getAIUnavailableMessageForErrorCode("ai_output_too_long", t)).toBeUndefined();
    expect(getAIUnavailableMessageForErrorCode("", t)).toBeUndefined();
    expect(getAIUnavailableMessageForErrorCode(undefined, t)).toBeUndefined();
  });
});

describe("getAIUnavailableActionLabel", () => {
  test("labels each action type", () => {
    expect(getAIUnavailableActionLabel("enable_ai", t)).toBe("common.ai_unavailable.enable_in_settings");
    expect(getAIUnavailableActionLabel("upgrade_plan", t)).toBe("common.upgrade_plan");
    expect(getAIUnavailableActionLabel("request_license", t)).toBe("common.request_trial_license");
  });
});
