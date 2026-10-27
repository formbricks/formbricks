import { describe, expect, test, vi } from "vitest";
import type { z } from "zod";
import { EXPECTED_UNENFORCED, readBundle, unenforcedKey } from "@formbricks/api-v3-schemas/testing";
import { WEB_URL_PATTERN } from "@formbricks/types/web-url";
import { ZV3CreateCreativeBody, ZV3PatchCreativeBody } from "./schemas";

vi.mock("server-only", () => ({}));

const WORKSPACE_ID = "clseedworkspace000000000";

/** Hosts the published pattern lets through and only `isWebUrl` refuses: these prove the refinement. */
const UNDERSCORE_HOST = "https://my_host.example.com";
const BAD_OCTET = "https://256.1.1.1";

const banner = (extra: Record<string, unknown> = {}) => ({
  workspaceId: WORKSPACE_ID,
  name: "Banner",
  type: "banner",
  content: {
    message: { "en-US": [{ text: "Open enrollment" }] },
    button: null,
    dismissible: true,
    accessibleName: null,
  },
  ...extra,
});

const feedbackButton = (extra: Record<string, unknown> = {}) => ({
  workspaceId: WORKSPACE_ID,
  name: "Feedback",
  type: "feedbackButton",
  content: { label: { "en-US": "Feedback" }, icon: null },
  ...extra,
});

const link = (url: string) => ({ destination: { type: "link", url } });

const bannerWithHref = (href: string) =>
  banner({
    content: {
      message: { "en-US": [{ text: "Read " }, { text: "the details", href }] },
      button: null,
      dismissible: true,
      accessibleName: null,
    },
  });

const issuePaths = (schema: z.ZodType, input: unknown) =>
  schema.safeParse(input).error?.issues.map((issue) => issue.path) ?? [];

describe("web links in the creative write bodies", () => {
  /**
   * The contract names the link Destination's rule (`format: web-url`) but the generator only publishes
   * its pattern, so `EXPECTED_UNENFORCED` pins each place it reaches on this module. Every pin needs a
   * counterexample the refinement refuses — one the pattern alone would accept.
   */
  const CASES: Record<string, { schema: z.ZodType; input: unknown }> = {
    "CreateBannerCreativeRequest $.destination|type=link.url format": {
      schema: ZV3CreateCreativeBody,
      input: banner(link(UNDERSCORE_HOST)),
    },
    "CreateCreativeRequest $|type=banner.destination|type=link.url format": {
      schema: ZV3CreateCreativeBody,
      input: banner(link(BAD_OCTET)),
    },
    "CreateCreativeRequest $|type=feedbackButton.destination|type=link.url format": {
      schema: ZV3CreateCreativeBody,
      input: feedbackButton(link(UNDERSCORE_HOST)),
    },
    "CreateCreativeRequestBase $.destination|type=link.url format": {
      schema: ZV3CreateCreativeBody,
      input: feedbackButton(link("https://example.c0m")),
    },
    "CreateFeedbackButtonCreativeRequest $.destination|type=link.url format": {
      schema: ZV3CreateCreativeBody,
      input: feedbackButton(link(BAD_OCTET)),
    },
    "CreativeDestinationInput $|type=link.url format": {
      schema: ZV3PatchCreativeBody,
      input: link("https://-example.com"),
    },
    "CreativeLinkDestinationInput $.url format": {
      schema: ZV3PatchCreativeBody,
      input: link("https://example.com:70000"),
    },
    "PatchCreativeRequest $.destination|type=link.url format": {
      schema: ZV3PatchCreativeBody,
      input: link(UNDERSCORE_HOST),
    },
  };

  const pins = EXPECTED_UNENFORCED.filter(
    (pin) => pin.enforcedBy === "apps/web/app/api/v3/creatives/lib/schemas.ts"
  );

  test("every pin this module enforces has a counterexample, and no counterexample is stale", () => {
    expect(Object.keys(CASES).sort()).toEqual(pins.map(unenforcedKey).sort());
  });

  test.each(Object.entries(CASES))("%s is refused at destination.url", (_key, { schema, input }) => {
    expect(issuePaths(schema, input)).toContainEqual(["destination", "url"]);
  });

  test.each(["https://asd.", "https://asdasd", "https://"])("the pattern refuses %s", (url) => {
    expect(issuePaths(ZV3PatchCreativeBody, link(url))).toContainEqual(["destination", "url"]);
  });

  test.each(["https://example.com/pricing", "http://localhost:3000", "https://xn--mnchen-3ya.de"])(
    "a link Destination of %s is accepted",
    (url) => {
      expect(ZV3CreateCreativeBody.safeParse(banner(link(url))).success).toBe(true);
      expect(ZV3PatchCreativeBody.safeParse(link(url)).success).toBe(true);
    }
  );

  const HREF_PATH = ["content", "message", "en-US", 1, "href"];

  test.each([UNDERSCORE_HOST, BAD_OCTET, "https://asd.", "https://asd"])(
    "a banner text link to %s is refused at its run",
    (href) => {
      expect(issuePaths(ZV3CreateCreativeBody, bannerWithHref(href))).toContainEqual(HREF_PATH);
      expect(issuePaths(ZV3PatchCreativeBody, { content: bannerWithHref(href).content })).toContainEqual(
        HREF_PATH
      );
    }
  );

  test.each(["https://example.com/details", "mailto:help@example.com", "tel:+15551234", "/open-enrollment"])(
    "a banner text link to %s is accepted",
    (href) => {
      expect(ZV3CreateCreativeBody.safeParse(bannerWithHref(href)).success).toBe(true);
    }
  );

  test("the contract publishes the pattern isWebUrl checks first", () => {
    // A pattern looser than the helper's would let the editor accept links the API refuses, or the
    // other way round; the spec and `packages/types/web-url.ts` must move together.
    const schemas = readBundle().components as {
      schemas: Record<string, { properties: Record<string, { pattern: string }> }>;
    };
    const urlPattern = schemas.schemas.CreativeLinkDestinationInput.properties.url.pattern;
    const hrefPattern = schemas.schemas.CreativeTextRun.properties.href.pattern;
    const webRest = urlPattern.slice("^https?://".length, -1);

    expect(new RegExp(urlPattern).source).toBe(WEB_URL_PATTERN.source);
    expect(hrefPattern).toBe(String.raw`^(?:https?://${webRest}|(?:mailto:|tel:|/(?!/))\S*)$`);
  });
});
