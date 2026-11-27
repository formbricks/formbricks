import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { listV3Segments } from "@/app/api/v3/segments/lib/operations";
import {
  createWorkspaceOnContactDirectory,
  createWorkspaceWithContactDirectory,
} from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";

/**
 * GET /api/v3/segments against real Postgres, for a segment shared by two workspaces of one directory
 * (decision 24). The list takes out survey ids the caller may not see (ENG-3282), but must keep ids of
 * the other workspace's surveys: the editor shows those as "Survey in another workspace", and a save
 * keeps only what the editor sent back, so taking them out here made any edit from the second workspace
 * drop the first workspace's survey from the filter.
 *
 * Auth and the Contacts licence are stubbed; survey visibility is the real predicate for an API key,
 * which sees no restricted survey.
 */

let organizationId: string;

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(async (_auth: unknown, workspaceId: string) => ({
    workspaceId,
    organizationId,
  })),
}));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: async () => true,
}));
vi.mock("@/app/api/v3/surveys/visibility-context", () => ({
  resolveV3VisibleSurveyWhere: async () => buildVisibleSurveyWhere({ enforced: true, kind: "apiKey" }),
}));

let workspaceA: string;
let workspaceB: string;
let workspaceC: string;
let directoryD: string;
const surveys = { a: "", b: "", bRestricted: "", c: "" };

const createSurvey = async (workspaceId: string, extra: Record<string, unknown> = {}) =>
  (
    await prisma.survey.create({
      data: { name: "Survey", type: "app", status: "inProgress", workspaceId, ...extra },
      select: { id: true },
    })
  ).id;

const listFrom = async (workspaceId: string) => {
  const response = await listV3Segments({
    searchParams: new URLSearchParams([["workspaceId", workspaceId]]),
    authentication: null,
    requestId: "req_1",
    instance: "/api/v3/segments",
  });
  expect(response.status).toBe(200);
  return (await response.json()).data;
};

beforeEach(async () => {
  await resetDb();
  organizationId = (await prisma.organization.create({ data: { name: "Shared filter Org" } })).id;
  ({ workspaceId: workspaceA, directoryId: directoryD } = await createWorkspaceWithContactDirectory(
    organizationId,
    "A"
  ));
  workspaceB = await createWorkspaceOnContactDirectory(organizationId, directoryD, "B");
  ({ workspaceId: workspaceC } = await createWorkspaceWithContactDirectory(organizationId, "C"));
  const owner = await prisma.user.create({ data: { name: "Owner", email: "owner@shared-filter.test" } });

  surveys.a = await createSurvey(workspaceA);
  surveys.b = await createSurvey(workspaceB);
  surveys.bRestricted = await createSurvey(workspaceB, { visibility: "restricted", ownerId: owner.id });
  surveys.c = await createSurvey(workspaceC);

  // Made in A, naming one survey of each kind. Inserted directly: creating it through the service
  // would refuse the surveys of B and C, which is not what this test is about.
  await prisma.segment.create({
    data: {
      title: "Shared",
      isPrivate: false,
      workspaceId: workspaceA,
      directoryId: directoryD,
      filters: [
        {
          id: "clfilter00000000000000001",
          connector: null,
          resource: {
            id: "clresrc000000000000000001",
            root: { type: "surveyInteraction" },
            qualifier: { operator: "haveSeen" },
            value: {
              surveyScope: "specific",
              surveyIds: [surveys.a, surveys.b, surveys.bRestricted, surveys.c],
              within: { amount: 1, unit: "months" },
            },
          },
        },
      ],
    },
  });
});

describe("survey ids in a shared segment's filters, listed from the other workspace", () => {
  test("keep the other workspace's survey, drop a hidden own survey and another directory's", async () => {
    const [segment] = await listFrom(workspaceB);

    expect([...segment.filters[0].resource.value.surveyIds].sort()).toEqual([surveys.a, surveys.b].sort());
  });
});
