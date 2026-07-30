import { describe, expect, test } from "vitest";
import {
  getManagedResourceTypes,
  isManagedResourceType,
  isUnprojectedResourceType,
  summarizeObservation,
  toSourceRef,
} from "./backfill-diff";
import type { TAuthzedRelationship } from "./client";

const tuple = (
  resourceType: string,
  resourceId: string,
  relation: string,
  subjectType: string,
  subjectId: string,
  subjectRelation?: string
): TAuthzedRelationship => ({
  relation,
  resource: { objectId: resourceId, objectType: resourceType },
  subject: {
    objectId: subjectId,
    objectType: subjectType,
    ...(subjectRelation ? { relation: subjectRelation } : {}),
  },
});

describe("toSourceRef", () => {
  test.each(["owner", "manager", "member", "billing"])(
    "maps organization#%s@user to the membership row",
    (relation) => {
      expect(toSourceRef(tuple("organization", "org-1", relation, "user", "user-1"))).toEqual({
        kind: "membership",
        organizationId: "org-1",
        userId: "user-1",
      });
    }
  );

  test.each(["api_key_reader", "api_key_writer"])(
    "maps organization#%s@api_key to the API key, since the flags live on the key's record",
    (relation) => {
      expect(toSourceRef(tuple("organization", "org-1", relation, "api_key", "key-1"))).toEqual({
        apiKeyId: "key-1",
        kind: "apiKey",
      });
    }
  );

  test("maps team#organization to the team row", () => {
    expect(toSourceRef(tuple("team", "team-1", "organization", "organization", "org-1"))).toEqual({
      kind: "team",
      teamId: "team-1",
    });
  });

  test.each(["admin", "contributor"])("maps team#%s@user to the team membership row", (relation) => {
    expect(toSourceRef(tuple("team", "team-1", relation, "user", "user-1"))).toEqual({
      kind: "teamMembership",
      teamId: "team-1",
      userId: "user-1",
    });
  });

  test("maps workspace#organization to the workspace row", () => {
    expect(toSourceRef(tuple("workspace", "ws-1", "organization", "organization", "org-1"))).toEqual({
      kind: "workspace",
      workspaceId: "ws-1",
    });
  });

  test.each(["reader_team", "writer_team", "manager_team"])(
    "maps workspace#%s@team#member to the workspace-team grant",
    (relation) => {
      expect(toSourceRef(tuple("workspace", "ws-1", relation, "team", "team-1", "member"))).toEqual({
        kind: "workspaceTeamGrant",
        teamId: "team-1",
        workspaceId: "ws-1",
      });
    }
  );

  test.each(["reader", "writer", "manager"])(
    "maps workspace#%s@api_key to the API-key workspace grant",
    (relation) => {
      expect(toSourceRef(tuple("workspace", "ws-1", relation, "api_key", "key-1"))).toEqual({
        apiKeyId: "key-1",
        kind: "apiKeyWorkspaceGrant",
        workspaceId: "ws-1",
      });
    }
  );

  test("maps api_key#organization to the API key row", () => {
    expect(toSourceRef(tuple("api_key", "key-1", "organization", "organization", "org-1"))).toEqual({
      apiKeyId: "key-1",
      kind: "apiKey",
    });
  });

  test("distinguishes an api-key workspace grant from a team workspace grant", () => {
    // The relations differ only by suffix and the subject type, and confusing them would name the
    // wrong source record — so a present grant would look absent, and pruning would revoke it.
    expect(toSourceRef(tuple("workspace", "ws-1", "manager", "api_key", "key-1"))).toEqual({
      apiKeyId: "key-1",
      kind: "apiKeyWorkspaceGrant",
      workspaceId: "ws-1",
    });
    expect(toSourceRef(tuple("workspace", "ws-1", "manager_team", "team", "team-1", "member"))).toEqual({
      kind: "workspaceTeamGrant",
      teamId: "team-1",
      workspaceId: "ws-1",
    });
  });

  test.each([
    ["an unknown resource type", tuple("chart", "chart-1", "workspace", "workspace", "ws-1")],
    ["an unknown relation", tuple("organization", "org-1", "superuser", "user", "user-1")],
    ["a role relation with the wrong subject type", tuple("organization", "org-1", "owner", "api_key", "k")],
    [
      "an api-key flag with the wrong subject type",
      tuple("organization", "o", "api_key_reader", "user", "u"),
    ],
    ["a team grant with the wrong subject type", tuple("workspace", "ws-1", "reader_team", "user", "u")],
    ["a workspace grant with the wrong subject type", tuple("workspace", "ws-1", "reader", "user", "u")],
    ["a parent relation with the wrong subject type", tuple("team", "team-1", "organization", "user", "u")],
    ["an api_key resource with an unexpected relation", tuple("api_key", "key-1", "reader", "user", "u")],
  ])("declines to name a source record for %s", (_label, relationship) => {
    expect(toSourceRef(relationship)).toBeNull();
  });
});

describe("resource type classification", () => {
  test.each(["api_key", "organization", "team", "workspace"])("treats %s as managed", (resourceType) => {
    expect(isManagedResourceType(resourceType)).toBe(true);
    expect(isUnprojectedResourceType(resourceType)).toBe(false);
  });

  test.each(["survey", "dashboard", "response"])(
    "treats %s as deliberately unprojected, not managed",
    (resourceType) => {
      // These exist in the schema for later resource-level sharing. Pruning them would delete
      // relationships a future projector is expected to own.
      expect(isUnprojectedResourceType(resourceType)).toBe(true);
      expect(isManagedResourceType(resourceType)).toBe(false);
    }
  );

  test("exposes the managed types for a resource-type sweep", () => {
    expect([...getManagedResourceTypes()].sort()).toEqual(["api_key", "organization", "team", "workspace"]);
  });
});

describe("summarizeObservation", () => {
  test("collects the source records an observation implies", () => {
    const summary = summarizeObservation([
      tuple("organization", "org-1", "owner", "user", "user-1"),
      tuple("team", "team-1", "organization", "organization", "org-1"),
      tuple("workspace", "ws-1", "reader", "api_key", "key-1"),
    ]);

    expect(summary.sourceRefs).toHaveLength(3);
    expect(summary.sourceRefs).toEqual(
      expect.arrayContaining([
        { kind: "membership", organizationId: "org-1", userId: "user-1" },
        { kind: "team", teamId: "team-1" },
        { apiKeyId: "key-1", kind: "apiKeyWorkspaceGrant", workspaceId: "ws-1" },
      ])
    );
    expect(summary.ignored).toBe(0);
    expect(summary.unmanaged).toEqual([]);
  });

  test("deduplicates records implied by more than one relationship", () => {
    const summary = summarizeObservation([
      tuple("api_key", "key-1", "organization", "organization", "org-1"),
      tuple("organization", "org-1", "api_key_reader", "api_key", "key-1"),
      tuple("organization", "org-1", "api_key_writer", "api_key", "key-1"),
    ]);

    // All three imply the same API key record, so it is looked up once.
    expect(summary.sourceRefs).toEqual([{ apiKeyId: "key-1", kind: "apiKey" }]);
  });

  test("counts unprojected resource types as ignored without naming a record", () => {
    const summary = summarizeObservation([
      tuple("survey", "survey-1", "workspace", "workspace", "ws-1"),
      tuple("dashboard", "dash-1", "workspace", "workspace", "ws-1"),
      tuple("response", "resp-1", "survey", "survey", "survey-1"),
    ]);

    expect(summary).toEqual({ ignored: 3, sourceRefs: [], unmanaged: [] });
  });

  test("reports unrecognized relationships without naming a record for them", () => {
    const summary = summarizeObservation([
      tuple("organization", "org-1", "superuser", "user", "user-1"),
      tuple("chart", "chart-1", "workspace", "workspace", "ws-1"),
    ]);

    // Reported so they are visible, but never reconciled: the tooling cannot know which source record,
    // if any, should own them.
    expect(summary.sourceRefs).toEqual([]);
    expect(summary.unmanaged).toEqual([
      { objectId: "chart-1", objectType: "chart", relation: "workspace" },
      { objectId: "org-1", objectType: "organization", relation: "superuser" },
    ]);
  });

  test("orders output deterministically so repeated runs are comparable", () => {
    const relationships = [
      tuple("workspace", "ws-2", "organization", "organization", "org-1"),
      tuple("organization", "org-1", "owner", "user", "user-2"),
      tuple("workspace", "ws-1", "organization", "organization", "org-1"),
      tuple("organization", "org-1", "owner", "user", "user-1"),
    ];

    const first = summarizeObservation(relationships);
    const second = summarizeObservation([...relationships].reverse());

    expect(first).toEqual(second);
  });

  test("returns an empty summary for an empty observation", () => {
    expect(summarizeObservation([])).toEqual({ ignored: 0, sourceRefs: [], unmanaged: [] });
  });
});
