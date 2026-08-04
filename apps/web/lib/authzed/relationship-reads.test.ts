import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthzedRelationship, TAuthzedRelationshipPage } from "./client";
import { AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT, AUTHZED_MAX_RELATIONSHIP_READS } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { forEachRelationshipPage, readAllRelationships } from "./relationship-reads";

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

  test("threads the cursor and varies nothing else between pages", async () => {
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1")).mockResolvedValueOnce({
      cursor: null,
      relationships: [relationship("last")],
      snapshot: { token: "revision-1" },
    });

    const observation = await readAllRelationships(client, filter);

    expect(observation.relationships).toHaveLength(AUTHZED_MAX_RELATIONSHIP_READS + 1);
    expect(observation.snapshot).toEqual({ token: "revision-1" });

    // SpiceDB rejects a cursor presented alongside any other changed argument, so the second request
    // must differ from the first by the cursor alone.
    expect(readRelationships.mock.calls[0][0]).toEqual({
      filter,
      limit: AUTHZED_MAX_RELATIONSHIP_READS,
    });
    expect(readRelationships.mock.calls[1][0]).toEqual({
      cursor: { token: "cursor-1" },
      filter,
      limit: AUTHZED_MAX_RELATIONSHIP_READS,
    });
  });

  test("abandons the read when a later page reports a different revision", async () => {
    // The cursor is supposed to hold the revision steady. If it ever did not, the pages would describe
    // different views and a pruning caller could delete a relationship that merely moved between them.
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1")).mockResolvedValueOnce({
      cursor: null,
      relationships: [relationship("last")],
      snapshot: { token: "revision-2" },
    });

    await expect(readAllRelationships(client, filter)).rejects.toThrow(AUTHZED_ERROR_CODES.ABORTED);
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
    // A distinct cursor per page, because a real server advances it — and a fixture that repeats one
    // cursor now trips the stall guard instead, which is a different failure than this test is about.
    let page = 0;
    readRelationships.mockImplementation(() => {
      page += 1;

      return Promise.resolve(fullPage(`page-${page}`, `cursor-${page}`));
    });

    await expect(readAllRelationships(client, filter)).rejects.toThrow(AUTHZED_ERROR_CODES.LIMIT_EXCEEDED);
    expect(readRelationships).toHaveBeenCalledTimes(pagesToExceed + 1);
  });

  test("propagates a mid-drain failure instead of reporting what it read so far", async () => {
    // Returning the pages already read would tell a pruning caller that the unread relationships do
    // not exist.
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

describe("forEachRelationshipPage", () => {
  test("streams every page without accumulating them", async () => {
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1")).mockResolvedValueOnce({
      cursor: null,
      relationships: [relationship("last")],
      snapshot: { token: "revision-1" },
    });
    const pageSizes: number[] = [];

    const snapshot = await forEachRelationshipPage(client, filter, async (relationships) => {
      pageSizes.push(relationships.length);
    });

    expect(pageSizes).toEqual([AUTHZED_MAX_RELATIONSHIP_READS, 1]);
    expect(snapshot).toEqual({ token: "revision-1" });
  });

  test("aborts a bounded drain on a cursor that does not advance", async () => {
    // The accumulation cap cannot stand in for this guard: a stalled cursor returning empty pages never
    // grows the accumulator, so the loop would spin forever instead of tripping the bound.
    const readRelationships = vi
      .fn()
      .mockResolvedValue({ cursor: { token: "stuck" }, relationships: [], snapshot: null });

    await expect(readAllRelationships({ readRelationships }, { resourceType: "team" })).rejects.toThrow(
      AUTHZED_ERROR_CODES.INTERNAL
    );
    expect(readRelationships).toHaveBeenCalledTimes(2);
  });

  test("aborts on a cursor that does not advance rather than spinning forever", async () => {
    // Termination depends on the server returning a cursor that moves. A command that hangs with no
    // output and no exit code is worse for an operator than one that fails loudly.
    readRelationships.mockResolvedValue(fullPage("stuck", "same-cursor"));

    await expect(forEachRelationshipPage(client, filter, async () => {})).rejects.toThrow(
      AUTHZED_ERROR_CODES.INTERNAL
    );
  });

  test("propagates a callback failure so a partial stream cannot look complete", async () => {
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1"));

    await expect(
      forEachRelationshipPage(client, filter, async () => {
        throw new Error("classification failed");
      })
    ).rejects.toThrow("classification failed");
  });

  test("aborts when a later page reports a different revision", async () => {
    readRelationships.mockResolvedValueOnce(fullPage("first", "cursor-1")).mockResolvedValueOnce({
      cursor: null,
      relationships: [relationship("last")],
      snapshot: { token: "revision-2" },
    });

    await expect(forEachRelationshipPage(client, filter, async () => {})).rejects.toThrow(
      AUTHZED_ERROR_CODES.ABORTED
    );
  });
});
