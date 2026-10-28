import { describe, expect, test } from "vitest";
import {
  buildConsentGroups,
  buildGrantedScope,
  canAllowAccess,
  getDefaultSelection,
  hasWriteScope,
  parseRequestedScopes,
  toggleScope,
} from "./consent-scopes";

const MCP_REQUEST = [
  "surveys:read",
  "surveys:write",
  "workflows:read",
  "workflows:write",
  "feedbackRecords:read",
  "feedbackRecords:write",
  "responses:read",
  "responses:write",
  "contacts:read",
  "contacts:write",
  "webhooks:read",
  "webhooks:write",
  "audit:read",
  "offline_access",
];

describe("parseRequestedScopes", () => {
  test("splits on any whitespace and drops blanks and repeats", () => {
    expect(parseRequestedScopes("openid  surveys:read\tsurveys:read\n")).toEqual(["openid", "surveys:read"]);
    expect(parseRequestedScopes(null)).toEqual([]);
    expect(parseRequestedScopes("")).toEqual([]);
  });
});

describe("buildConsentGroups", () => {
  test("groups a full MCP request the way the screen shows it, reads before writes", () => {
    expect(buildConsentGroups(MCP_REQUEST).map(({ id, scopes }) => [id, scopes])).toEqual([
      ["surveys_workflows", ["surveys:read", "surveys:write", "workflows:read", "workflows:write"]],
      ["feedback", ["feedbackRecords:read", "feedbackRecords:write"]],
      ["respondent_data", ["responses:read", "responses:write", "contacts:read", "contacts:write"]],
      ["integrations_audit", ["webhooks:read", "webhooks:write", "audit:read"]],
    ]);
  });

  test("offers only requested scopes and flags respondent data", () => {
    const groups = buildConsentGroups(["openid", "responses:read", "unknown:read", "offline_access"]);

    expect(groups).toEqual([{ id: "respondent_data", personalData: true, scopes: ["responses:read"] }]);
  });
});

describe("getDefaultSelection", () => {
  test("starts with configuration ticked and respondent data, webhooks and audit unticked", () => {
    expect(getDefaultSelection(MCP_REQUEST)).toEqual([
      "surveys:read",
      "surveys:write",
      "workflows:read",
      "feedbackRecords:read",
    ]);
  });

  test("never ticks something that was not requested", () => {
    expect(getDefaultSelection(["feedbackRecords:read"])).toEqual(["feedbackRecords:read"]);
  });
});

describe("toggleScope", () => {
  test("ticking write also ticks the read of the same family", () => {
    expect(
      toggleScope({ selected: [], scope: "workflows:write", checked: true, requested: MCP_REQUEST }).sort()
    ).toEqual(["workflows:read", "workflows:write"]);
  });

  test("unticking read also unticks the write", () => {
    expect(
      toggleScope({
        selected: ["surveys:read", "surveys:write", "workflows:read"],
        scope: "surveys:read",
        checked: false,
        requested: MCP_REQUEST,
      })
    ).toEqual(["workflows:read"]);
  });

  test("does not add a read the client never asked for, nor a scope it did not request", () => {
    const requested = ["webhooks:write"];

    expect(toggleScope({ selected: [], scope: "webhooks:write", checked: true, requested })).toEqual([
      "webhooks:write",
    ]);
    expect(toggleScope({ selected: [], scope: "contacts:read", checked: true, requested })).toEqual([]);
  });
});

describe("buildGrantedScope", () => {
  test("keeps requested identity scopes, the ticked resources and, when kept, refresh tokens", () => {
    expect(
      buildGrantedScope({
        requested: ["openid", "profile", "email", "offline_access", "surveys:read", "responses:read"],
        selected: ["surveys:read"],
        keepAccess: true,
      })
    ).toBe("openid profile email offline_access surveys:read");
  });

  test("drops offline_access when it is unticked", () => {
    expect(
      buildGrantedScope({
        requested: ["openid", "offline_access", "surveys:read"],
        selected: ["surveys:read"],
        keepAccess: false,
      })
    ).toBe("openid surveys:read");
  });

  test("never grants a scope the client did not request, even if it is ticked", () => {
    expect(
      buildGrantedScope({
        requested: ["openid", "surveys:read"],
        selected: ["surveys:read", "responses:read", "offline_access"],
        keepAccess: true,
      })
    ).toBe("openid surveys:read");
  });

  test("drops scopes it does not know, so nothing is granted the person was not shown", () => {
    expect(
      buildGrantedScope({
        requested: ["openid", "billing:write", "surveys:read"],
        selected: ["surveys:read", "billing:write"],
        keepAccess: true,
      })
    ).toBe("openid surveys:read");
  });
});

describe("canAllowAccess", () => {
  test("needs a resource scope ticked when the client asked for any", () => {
    expect(canAllowAccess({ requested: MCP_REQUEST, selected: [] })).toBe(false);
    expect(canAllowAccess({ requested: MCP_REQUEST, selected: ["audit:read"] })).toBe(true);
  });

  test("a client that asked for no resource has nothing to choose", () => {
    expect(canAllowAccess({ requested: ["openid"], selected: [] })).toBe(true);
  });
});

describe("hasWriteScope", () => {
  test("is true only when a write scope is ticked", () => {
    expect(hasWriteScope(["surveys:read", "audit:read"])).toBe(false);
    expect(hasWriteScope(["surveys:read", "contacts:write"])).toBe(true);
  });
});
