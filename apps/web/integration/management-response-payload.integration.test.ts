import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ZResponse } from "@formbricks/database/zod/responses";
import { resetDb } from "@/integration/reset-db";
import { getResponse as getV1Response } from "@/lib/response/service";
import {
  getResponse,
  getResponseForPipeline,
} from "@/modules/api/v2/management/responses/[responseId]/lib/response";
import { getResponses } from "@/modules/api/v2/management/responses/lib/response";
import { ZGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";

/**
 * Which columns the management APIs serve for a response, against real Postgres.
 *
 * `Response.ingestFlags` is internal Embedded Data bookkeeping (ENG-1845). The v2 management routes and
 * the pipeline read whole rows without a `select`, so until the client omitted the column globally
 * (packages/database/src/client.ts) they handed it to integrators and webhook consumers while no
 * OpenAPI bundle described it (ENG-2955). The unit harness mocks Prisma, so only a real client can show
 * what a select-less read returns — and that the one legitimate reader, which selects the column
 * explicitly, still gets it.
 *
 * The shape assertion is the part meant to outlive the ticket: every key a v2 read serves must be a key
 * `ZResponse` documents, so the next internal column fails here instead of reaching a payload.
 */

const INGEST_FLAGS = [{ key: "plan", reason: "coercion_failed" }];

const DOCUMENTED_KEYS = Object.keys(ZResponse.shape).sort();

const BLOCKS = [
  {
    id: "clbk1234567890123456789013",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const seedResponse = async () => {
  const organization = await prisma.organization.create({ data: { name: "Payload Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Payload Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "Payload Survey",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: BLOCKS,
    },
    select: { id: true },
  });
  const response = await prisma.response.create({
    data: { surveyId: survey.id, finished: true, data: { plan: "gold" }, ingestFlags: INGEST_FLAGS },
    select: { id: true },
  });

  return { workspaceId: workspace.id, responseId: response.id };
};

const servedKeys = (row: object): string[] => Object.keys(row).sort();

beforeEach(async () => {
  await resetDb();
});

describe("ingestFlags at the Prisma client", () => {
  test("the column is stored, and an explicit select still reads it", async () => {
    // The ingest path (lib/response/service.ts `updateResponse`) merges into the stored flags through
    // exactly this kind of select. A global omit must not take the column away from it.
    const { responseId } = await seedResponse();

    const stored = await prisma.response.findUniqueOrThrow({
      where: { id: responseId },
      select: { ingestFlags: true },
    });

    expect(stored).toEqual({ ingestFlags: INGEST_FLAGS });
  });

  test("a read without a select does not return it", async () => {
    const { responseId } = await seedResponse();

    const row = await prisma.response.findUniqueOrThrow({ where: { id: responseId } });

    expect(row).not.toHaveProperty("ingestFlags");
    expect(row.finished).toBe(true);
  });
});

describe("what the management APIs serve for a response", () => {
  test("v2 list serves exactly the keys the v2 OpenAPI schema documents", async () => {
    const { workspaceId } = await seedResponse();

    const result = await getResponses([workspaceId], ZGetResponsesFilter.parse({}));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.data).toHaveLength(1);
    expect(servedKeys(result.data.data[0])).toEqual(DOCUMENTED_KEYS);
  });

  test("v2 single read serves exactly the documented keys", async () => {
    const { responseId } = await seedResponse();

    const result = await getResponse(responseId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(servedKeys(result.data)).toEqual(DOCUMENTED_KEYS);
  });

  test("the pipeline read, which becomes the webhook body, does not carry it", async () => {
    const { responseId } = await seedResponse();

    const result = await getResponseForPipeline(responseId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty("ingestFlags");
  });

  test("v1 agrees with v2", async () => {
    // v1 always selected its columns (`responseSelection`), so this is the baseline v2 now matches.
    const { responseId } = await seedResponse();

    const served = await getV1Response(responseId);

    expect(served).not.toBeNull();
    expect(served).not.toHaveProperty("ingestFlags");
  });
});
