import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthzedRelationship, TAuthzedRelationshipPage } from "./client";
import { AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT, AUTHZED_MAX_RELATIONSHIP_READS } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { readAllRelationships } from "./relationship-reads";

const relationship = (objectId: string): TAuthzedRelationship => ({
  relation: "owner",
  resource: { objectId, objectType: "organization" },
  subject: { objectId: "user-1", objectType: "user" },
});

/** A page of exactly `AUTHZED_MAX_RELATIONSHIP_READS` relationships, i.e. one that may have more behind it. */
const fullPage = (prefix: string, cursor: string | null): TAuthzedRelationshipPage => ({
  cursor: cursor ? { token: cursor } : null,
  relationships: Array.from({ length: AUTHZED_MAX_RELATIONSHIP_READS }, (_unused, index) =>
    relationship(`${prefix}-${index}`)
  ),
  snapshot: { token: "revision-1" },
});

const readRelationships = vi.fn();
const client = { readRelationships };
const filter = { resourceType: "organization" } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readAllRelationships", () => {
  test("resolves the first page without a pinned revision and returns the one it was given", async () => {
    readRelationships.mockResolvedValue({
      cursor: null,
      relationships: [relationship("org-1")],
      snapshot: { token: "revision-1" },
    });

    await expect(readAllRelationships(client, filter)).resolves.toEqual({
      relationships: [relationship("org-1")],
      snapshot: { token: "revision-1" },
    });

    expect(readRelationships).toHaveBeenCalledTimes(1);
    expect(readRelationships).toHaveBeenCalledWith({
      filter,
      limit: AUTHZED_MAX_RELATIONSHIP_READS,
    });
  });

  test("pins every later page to the first page's revision and threads the cursor", async () => {
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1")).mockResolvedValueOnce({
      cursor: null,
      relationships: [relationship("last")],
      snapshot: { token: "revision-1" },
    });

    const observation = await readAllRelationships(client, filter);

    expect(observation.relationships).toHaveLength(AUTHZED_MAX_RELATIONSHIP_READS + 1);
    expect(observation.snapshot).toEqual({ token: "revision-1" });

    // Page 1 resolves the revision; page 2 must not resolve its own, or a concurrent write could
    // hide a relationship from both pages and the caller would read it as absent.
    expect(readRelationships.mock.calls[0][0]).not.toHaveProperty("atSnapshot");
    expect(readRelationships.mock.calls[1][0]).toEqual({
      atSnapshot: { token: "revision-1" },
      cursor: { token: "cursor-1" },
      filter,
      limit: AUTHZED_MAX_RELATIONSHIP_READS,
    });
  });

  test("stops on a full page that offers no cursor", async () => {
    readRelationships.mockResolvedValueOnce(fullPage("only", null));

    await expect(readAllRelationships(client, filter)).resolves.toMatchObject({
      snapshot: { token: "revision-1" },
    });
    expect(readRelationships).toHaveBeenCalledTimes(1);
  });

  test("returns an empty observation with no revision when nothing matches", async () => {
    readRelationships.mockResolvedValue({ cursor: null, relationships: [], snapshot: null });

    await expect(readAllRelationships(client, filter)).resolves.toEqual({
      relationships: [],
      snapshot: null,
    });
  });

  test("abandons the read rather than returning a partial observation past the memory bound", async () => {
    // Every continued iteration consumes a full page, so the bound is also the loop bound.
    const pagesToExceed = Math.ceil(
      AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT / AUTHZED_MAX_RELATIONSHIP_READS
    );
    readRelationships.mockImplementation(() => Promise.resolve(fullPage("page", "cursor-next")));

    await expect(readAllRelationships(client, filter)).rejects.toThrow(AUTHZED_ERROR_CODES.LIMIT_EXCEEDED);
    expect(readRelationships).toHaveBeenCalledTimes(pagesToExceed + 1);
  });

  test("propagates a mid-drain snapshot expiry instead of reporting what it read so far", async () => {
    // SpiceDB rejects `atExactSnapshot` once the revision leaves the GC window. Returning the pages
    // already read would tell a pruning caller that the unread relationships do not exist.
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1")).mockRejectedValueOnce(
      new AuthzedError({
        attempts: 1,
        code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
        operation: "read_relationships",
        retryable: false,
      })
    );

    await expect(readAllRelationships(client, filter)).rejects.toThrow(
      AUTHZED_ERROR_CODES.FAILED_PRECONDITION
    );
  });

  test("propagates a first-page failure", async () => {
    readRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "read_relationships",
        retryable: true,
      })
    );

    await expect(readAllRelationships(client, filter)).rejects.toThrow(AUTHZED_ERROR_CODES.UNAVAILABLE);
  });

  test("passes a narrowed filter through unchanged on every page", async () => {
    const narrowed = {
      relation: "reader_team",
      resourceId: "ws-1",
      resourceType: "workspace",
      subject: { objectId: "team-1", objectType: "team", relation: "member" },
    } as const;
    readRelationships
      .mockResolvedValueOnce(fullPage("first", "cursor-1"))
      .mockResolvedValueOnce({ cursor: null, relationships: [], snapshot: { token: "revision-1" } });

    await readAllRelationships(client, narrowed);

    for (const call of readRelationships.mock.calls) {
      expect(call[0].filter).toBe(narrowed);
    }
  });
});
