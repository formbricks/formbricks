import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TBaseFilters } from "@formbricks/types/segment";
import { resetDb } from "@/integration/reset-db";
import { updateUser } from "@/modules/ee/contacts/api/v1/client/[workspaceId]/user/lib/update-user";
import { createContactAttributeKey } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { ContactDirectoryMissingError } from "@/modules/ee/contacts/lib/contact-directory";
import { createSegment, resetSegmentInSurvey } from "@/modules/ee/contacts/segments/lib/segments";
import { CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT } from "./constants";
import {
  ContactDirectoryArchiveHasWorkspacesError,
  ContactDirectoryArchivedError,
  ContactDirectoryNameTakenError,
  ContactDirectoryWorkspacesInOtherDirectoryError,
  ContactDirectoryWorkspacesNotMovableError,
} from "./directory-errors";
import {
  createContactDirectory,
  getContactDirectoryTargetedSurveys,
  listContactDirectories,
  updateContactDirectory,
} from "./directory-service";

/**
 * ENG-7498: a workspace with no contact directory, and what changes when it gets one. Real Postgres,
 * because the behaviour lives in the rolling-deploy trigger (it leaves `directoryId` empty for such a
 * workspace) and in the unique keys a key merge has to respect.
 */

beforeEach(async () => {
  await resetDb();
});

const createOrganization = async () =>
  (await prisma.organization.create({ data: { name: "ENG-7498 org" }, select: { id: true } })).id;

/** A workspace as `createWorkspace` makes it now: no directory, no keys (decisions 3 and 25). */
const createWorkspaceWithoutDirectory = async (organizationId: string, name = "No directory") =>
  (await prisma.workspace.create({ data: { name, organizationId }, select: { id: true } })).id;

/** A key a pod of the previous release created: only a `workspaceId`, so the trigger leaves no directory. */
const createOrphanKey = (workspaceId: string, key: string) =>
  prisma.contactAttributeKey.create({ data: { key, name: key, workspaceId }, select: { id: true } });

/** A contact with values on the given keys, as a pod of the previous release writes it. */
const createOrphanContact = async (workspaceId: string, values: { keyId: string; value: string }[]) =>
  prisma.contact.create({
    data: {
      workspaceId,
      attributes: { create: values.map(({ keyId, value }) => ({ attributeKeyId: keyId, value })) },
    },
    select: { id: true },
  });

const createSurveyFilteringOn = (workspaceId: string, attributeKeyId: string) =>
  prisma.survey.create({
    data: {
      name: "Filtered survey",
      workspaceId,
      type: "app",
      status: "draft",
      attributeFilters: { create: { attributeKeyId, condition: "equals", value: "pro" } },
    },
    select: { id: true },
  });

const attributesOf = (contactId: string) =>
  prisma.contactAttribute.findMany({
    where: { contactId },
    select: { value: true, attributeKey: { select: { key: true, directoryId: true, workspaceId: true } } },
    orderBy: { value: "asc" },
  });

describe("a workspace without a contact directory", () => {
  test("refuses identify until a directory is assigned, then works right away", async () => {
    const organizationId = await createOrganization();
    const workspaceId = await createWorkspaceWithoutDirectory(organizationId);

    await expect(updateUser(workspaceId, "user-1", "desktop")).rejects.toBeInstanceOf(
      ContactDirectoryMissingError
    );
    expect(await prisma.contact.count()).toBe(0);

    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [workspaceId],
    });

    const result = await updateUser(workspaceId, "user-1", "desktop");

    const contact = await prisma.contact.findFirstOrThrow({ select: { id: true, directoryId: true } });
    expect(result.state.data?.contactId).toBe(contact.id);
    expect(contact.directoryId).toBe(directoryId);
  });

  test("its first directory adopts the contacts, keys and segments a previous-release pod wrote", async () => {
    const organizationId = await createOrganization();
    const workspaceId = await createWorkspaceWithoutDirectory(organizationId);
    const email = await createOrphanKey(workspaceId, "email");
    const plan = await createOrphanKey(workspaceId, "plan");
    const contact = await createOrphanContact(workspaceId, [
      { keyId: email.id, value: "a@example.com" },
      { keyId: plan.id, value: "pro" },
    ]);
    const survey = await createSurveyFilteringOn(workspaceId, email.id);
    const segment = await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    });

    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [workspaceId],
    });

    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      directoryId,
    });
    // `email` merged into the directory's own default key (no workspace of origin); `plan` joined as is.
    expect(await attributesOf(contact.id)).toEqual([
      { value: "a@example.com", attributeKey: { key: "email", directoryId, workspaceId: null } },
      { value: "pro", attributeKey: { key: "plan", directoryId, workspaceId } },
    ]);
    expect(await prisma.contactAttributeKey.findUnique({ where: { id: email.id } })).toBeNull();
    const filter = await prisma.surveyAttributeFilter.findFirstOrThrow({
      where: { surveyId: survey.id },
      select: { attributeKey: { select: { key: true, directoryId: true } } },
    });
    expect(filter.attributeKey).toEqual({ key: "email", directoryId });
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).toMatchObject({
      directoryId,
    });
  });

  test("joining a directory in use merges keys by name and leaves a segment whose title is taken", async () => {
    const organizationId = await createOrganization();
    const firstWorkspaceId = await createWorkspaceWithoutDirectory(organizationId, "First");
    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [firstWorkspaceId],
    });
    const directoryPlan = await prisma.contactAttributeKey.create({
      data: { key: "plan", name: "Plan", directoryId, workspaceId: firstWorkspaceId },
      select: { id: true },
    });
    await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId: firstWorkspaceId },
    });

    const workspaceId = await createWorkspaceWithoutDirectory(organizationId, "Second");
    const plan = await createOrphanKey(workspaceId, "plan");
    const contact = await createOrphanContact(workspaceId, [{ keyId: plan.id, value: "pro" }]);
    const survey = await createSurveyFilteringOn(workspaceId, plan.id);
    const segment = await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    });

    await updateContactDirectory({
      organizationId,
      directoryId,
      workspaceIds: [firstWorkspaceId, workspaceId],
    });

    const attribute = await prisma.contactAttribute.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(attribute.attributeKeyId).toBe(directoryPlan.id);
    const filter = await prisma.surveyAttributeFilter.findFirstOrThrow({ where: { surveyId: survey.id } });
    expect(filter.attributeKeyId).toBe(directoryPlan.id);
    expect(await prisma.contactAttributeKey.findUnique({ where: { id: plan.id } })).toBeNull();
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).toMatchObject({
      directoryId: null,
    });
  });
});

describe("moving a workspace never merges contacts", () => {
  // Decision 15: no merge in this release. A workspace that brings contacts may join a directory only
  // while that directory has none.
  test("refuses a directoryless workspace with contacts into a directory that has contacts", async () => {
    const organizationId = await createOrganization();
    const firstWorkspaceId = await createWorkspaceWithoutDirectory(organizationId, "First");
    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [firstWorkspaceId],
    });
    await prisma.contact.create({ data: { workspaceId: firstWorkspaceId, directoryId } });

    const workspaceId = await createWorkspaceWithoutDirectory(organizationId, "Second");
    const orphan = await createOrphanContact(workspaceId, []);

    await expect(
      updateContactDirectory({ organizationId, directoryId, workspaceIds: [firstWorkspaceId, workspaceId] })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotMovableError);

    expect(await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).toMatchObject({
      contactDirectoryId: null,
    });
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: orphan.id } })).toMatchObject({
      directoryId: null,
    });
  });
});

/** A stored segment filter list with one attribute filter on `key`. */
const filterOn = (contactAttributeKey: string): TBaseFilters => [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: { type: "attribute", contactAttributeKey },
      value: "x",
      qualifier: { operator: "equals" },
    },
  },
];

/** A directory with the given workspaces, made through the service as Settings makes it. */
const createDirectoryWith = async (organizationId: string, name: string, workspaceNames: string[]) => {
  const workspaceIds: string[] = [];
  for (const workspaceName of workspaceNames) {
    workspaceIds.push(await createWorkspaceWithoutDirectory(organizationId, workspaceName));
  }
  const { id: directoryId } = await createContactDirectory({
    organizationId,
    name,
    matchingKey: "email",
    workspaceIds,
  });
  return { directoryId, workspaceIds };
};

const directoryOf = async (workspaceId: string) =>
  (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).contactDirectoryId;

const isArchived = async (directoryId: string) =>
  (await prisma.contactDirectory.findUniqueOrThrow({ where: { id: directoryId } })).isArchived;

// Decision 1: removing a workspace only unlinks it; adding it back restores everything.
describe("removing a workspace from a directory", () => {
  test("only clears its directory: contacts, keys, segments and its surveys' segments stay", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [keptId, removedId],
    } = await createDirectoryWith(organizationId, "Customers", ["Kept", "Removed"]);
    const contact = await prisma.contact.create({ data: { workspaceId: removedId, directoryId } });
    const plan = await prisma.contactAttributeKey.create({
      data: { key: "plan", name: "Plan", directoryId, workspaceId: removedId },
    });
    const publicSegment = await prisma.segment.create({
      data: {
        title: "VIP",
        isPrivate: false,
        filters: filterOn("plan"),
        workspaceId: removedId,
        directoryId,
      },
    });
    const privateSegment = await prisma.segment.create({
      data: {
        title: "survey-1",
        isPrivate: true,
        filters: filterOn("plan"),
        workspaceId: removedId,
        directoryId,
      },
    });
    const surveys = await Promise.all(
      [publicSegment.id, privateSegment.id].map((segmentId) =>
        prisma.survey.create({
          data: { name: "Targeted", workspaceId: removedId, type: "app", status: "inProgress", segmentId },
          select: { id: true },
        })
      )
    );

    const result = await updateContactDirectory({ organizationId, directoryId, workspaceIds: [keptId] });

    expect(result.next).toMatchObject({ workspaceIds: [keptId], isArchived: false, pausedSurveyIds: [] });
    expect(await directoryOf(removedId)).toBeNull();
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      directoryId,
      workspaceId: removedId,
    });
    expect(await prisma.contactAttributeKey.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({
      directoryId,
    });
    for (const segment of [publicSegment, privateSegment]) {
      expect(await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).toMatchObject({
        directoryId,
      });
    }
    expect(
      await prisma.survey.findMany({
        where: { id: { in: surveys.map(({ id }) => id) } },
        select: { segmentId: true, status: true },
        orderBy: { segmentId: "asc" },
      })
    ).toEqual(
      [publicSegment.id, privateSegment.id]
        .sort((x, y) => x.localeCompare(y))
        .map((segmentId) => ({ segmentId, status: "inProgress" }))
    );
    expect(await isArchived(directoryId)).toBe(false);

    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [keptId, removedId] });

    expect(await directoryOf(removedId)).toBe(directoryId);
    expect(await prisma.contact.count({ where: { directoryId } })).toBe(1);
  });

  test("pauses, when asked, only the removed workspace's running app surveys with a filtered segment", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [keptId, removedId],
    } = await createDirectoryWith(organizationId, "Customers", ["Kept", "Removed"]);
    const segment = (
      workspaceId: string,
      filters: unknown[],
      isPrivate = true,
      title = `s-${filters.length}`
    ) =>
      prisma.segment.create({
        data: {
          title: `${title}-${workspaceId}`,
          isPrivate,
          filters: filters as never,
          workspaceId,
          directoryId,
        },
        select: { id: true },
      });
    const filtered = await segment(removedId, filterOn("email"));
    const publicFiltered = await segment(removedId, filterOn("email"), false, "public");
    const unfiltered = await segment(removedId, []);
    const keptFiltered = await segment(keptId, filterOn("email"));
    const publishOn = new Date(Date.now() + 86_400_000);
    const survey = async (
      name: string,
      data: {
        workspaceId?: string;
        type?: "app" | "link";
        status?: "inProgress" | "paused" | "draft" | "completed";
        segmentId?: string | null;
        publishOn?: Date;
        archivedAt?: Date;
      }
    ) =>
      (
        await prisma.survey.create({
          data: { name, workspaceId: removedId, type: "app", status: "inProgress", ...data },
          select: { id: true },
        })
      ).id;
    const running = await survey("Running", { segmentId: filtered.id });
    const scheduled = await survey("Scheduled", {
      status: "paused",
      publishOn,
      segmentId: publicFiltered.id,
    });
    const untouched = [
      await survey("No filters", { segmentId: unfiltered.id }),
      await survey("No segment", { segmentId: null }),
      await survey("Link", { type: "link", segmentId: filtered.id }),
      await survey("Draft", { status: "draft", segmentId: filtered.id }),
      await survey("Completed", { status: "completed", segmentId: filtered.id }),
      await survey("Paused", { status: "paused", segmentId: filtered.id }),
      await survey("Archived", { segmentId: filtered.id, archivedAt: new Date() }),
      await survey("Kept workspace", { workspaceId: keptId, segmentId: keptFiltered.id }),
    ];
    const statuses = async () =>
      Object.fromEntries(
        (await prisma.survey.findMany({ select: { id: true, status: true, publishOn: true } })).map(
          ({ id, status, publishOn: date }) => [id, { status, scheduled: date !== null }]
        )
      );
    const before = await statuses();

    // The confirm step lists exactly the surveys the save would pause.
    const targeted = await getContactDirectoryTargetedSurveys(organizationId, directoryId);
    expect(targeted?.workspaces.find((w) => w.workspaceId === removedId)?.surveys).toEqual([
      { id: running, name: "Running", status: "inProgress" },
      { id: scheduled, name: "Scheduled", status: "scheduled" },
    ]);

    const result = await updateContactDirectory({
      organizationId,
      directoryId,
      workspaceIds: [keptId],
      pauseSurveysInWorkspaceIds: [removedId, keptId],
    });

    const after = await statuses();
    expect(result.next.pausedSurveyIds.sort((x, y) => x.localeCompare(y))).toEqual(
      [running, scheduled].sort((x, y) => x.localeCompare(y))
    );
    expect(after[running]).toEqual({ status: "paused", scheduled: false });
    expect(after[scheduled]).toEqual({ status: "paused", scheduled: false });
    for (const id of untouched) expect(after[id]).toEqual(before[id]);
  });

  test("lists at most the limit of a workspace's targeted surveys, by name, and counts them all", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [workspaceId],
    } = await createDirectoryWith(organizationId, "Customers", ["Busy"]);
    const segment = await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: filterOn("email"), workspaceId, directoryId },
    });
    const total = CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT + 2;
    await prisma.survey.createMany({
      data: Array.from({ length: total }, (_, index) => ({
        name: `Survey ${String(total - index).padStart(3, "0")}`,
        workspaceId,
        type: "app" as const,
        status: "inProgress" as const,
        segmentId: segment.id,
      })),
    });

    const targeted = await getContactDirectoryTargetedSurveys(organizationId, directoryId);

    const [entry] = targeted?.workspaces ?? [];
    expect(entry.totalCount).toBe(total);
    expect(entry.surveys).toHaveLength(CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT);
    expect(entry.surveys[0].name).toBe("Survey 001");
    expect(entry.surveys.at(-1)?.name).toBe(
      `Survey ${String(CONTACT_DIRECTORY_TARGETED_SURVEYS_LIMIT).padStart(3, "0")}`
    );
  });

  test("pauses nothing without the option", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [keptId, removedId],
    } = await createDirectoryWith(organizationId, "Customers", ["Kept", "Removed"]);
    const segment = await prisma.segment.create({
      data: { title: "s", isPrivate: true, filters: filterOn("email"), workspaceId: removedId, directoryId },
    });
    const survey = await prisma.survey.create({
      data: {
        name: "Running",
        workspaceId: removedId,
        type: "app",
        status: "inProgress",
        segmentId: segment.id,
      },
    });

    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [keptId] });

    expect(await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } })).toMatchObject({
      status: "inProgress",
    });
  });
});

// Decision 3: a workspace joins only while it has no directory; nothing moves or gets deleted.
describe("joining a directory", () => {
  test("refuses a workspace that uses another directory, even one it is alone in", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId: soloId,
      workspaceIds: [soloWorkspaceId],
    } = await createDirectoryWith(organizationId, "Solo", ["Solo"]);
    const {
      directoryId: targetId,
      workspaceIds: [targetWorkspaceId],
    } = await createDirectoryWith(organizationId, "Target", ["Target"]);

    await expect(
      updateContactDirectory({
        organizationId,
        directoryId: targetId,
        workspaceIds: [targetWorkspaceId, soloWorkspaceId],
      })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesInOtherDirectoryError);
    await expect(
      createContactDirectory({
        organizationId,
        name: "New",
        matchingKey: "email",
        workspaceIds: [soloWorkspaceId],
      })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesInOtherDirectoryError);

    expect(await directoryOf(soloWorkspaceId)).toBe(soloId);
    expect(await prisma.contactDirectory.count({ where: { id: soloId } })).toBe(1);
    expect(await prisma.contactDirectory.count({ where: { name: "New" } })).toBe(0);
  });

  test("takes a workspace removed from another directory, whose old rows stay behind", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId: oldId,
      workspaceIds: [stayingId, movingId],
    } = await createDirectoryWith(organizationId, "Old", ["Staying", "Moving"]);
    const contact = await prisma.contact.create({ data: { workspaceId: movingId, directoryId: oldId } });
    await updateContactDirectory({ organizationId, directoryId: oldId, workspaceIds: [stayingId] });

    const { id: newId } = await createContactDirectory({
      organizationId,
      name: "New",
      matchingKey: "userId",
      workspaceIds: [movingId],
    });

    expect(await directoryOf(movingId)).toBe(newId);
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      directoryId: oldId,
    });
  });

  // The previous release's unique indexes on (key, workspaceId) and (workspaceId, title) stay until 7.0.
  test("lets a workspace reuse, in its new directory, the names of keys and segments it left behind", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId: oldId,
      workspaceIds: [stayingId, movingId],
    } = await createDirectoryWith(organizationId, "Old", ["Staying", "Moving"]);
    const plan = await prisma.contactAttributeKey.create({
      data: { key: "plan", name: "Plan", directoryId: oldId, workspaceId: movingId },
    });
    const vip = await prisma.segment.create({
      data: {
        title: "VIP",
        isPrivate: false,
        filters: filterOn("plan"),
        workspaceId: movingId,
        directoryId: oldId,
      },
    });
    const survey = await prisma.survey.create({
      data: { name: "Targeted", workspaceId: movingId, type: "app", status: "inProgress" },
    });
    const privateSegment = await prisma.segment.create({
      data: {
        title: survey.id,
        isPrivate: true,
        filters: filterOn("plan"),
        workspaceId: movingId,
        directoryId: oldId,
        surveys: { connect: { id: survey.id } },
      },
    });
    await updateContactDirectory({ organizationId, directoryId: oldId, workspaceIds: [stayingId] });

    const { id: newId } = await createContactDirectory({
      organizationId,
      name: "New",
      matchingKey: "email",
      workspaceIds: [movingId],
    });

    const newPlan = await createContactAttributeKey({ workspaceId: movingId, key: "plan" });
    const other = await prisma.survey.create({
      data: { name: "Other", workspaceId: movingId, type: "app", status: "draft" },
    });
    const newVip = await createSegment({
      workspaceId: movingId,
      surveyId: other.id,
      title: "VIP",
      isPrivate: false,
      filters: filterOn("plan"),
    });
    const reset = await resetSegmentInSurvey(survey.id);

    expect(await prisma.contactAttributeKey.findUniqueOrThrow({ where: { id: newPlan.id } })).toMatchObject({
      directoryId: newId,
      workspaceId: movingId,
    });
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: newVip.id } })).toMatchObject({
      directoryId: newId,
      workspaceId: movingId,
    });
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: reset.id } })).toMatchObject({
      title: survey.id,
      directoryId: newId,
      workspaceId: movingId,
    });
    // The old directory keeps its rows, now with no workspace of origin.
    for (const row of [
      await prisma.contactAttributeKey.findUniqueOrThrow({ where: { id: plan.id } }),
      await prisma.segment.findUniqueOrThrow({ where: { id: vip.id } }),
      await prisma.segment.findUniqueOrThrow({ where: { id: privateSegment.id } }),
    ]) {
      expect(row).toMatchObject({ directoryId: oldId, workspaceId: null });
    }
  });

  test("rejoining the same directory leaves the rows it kept there as they were", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [stayingId, movingId],
    } = await createDirectoryWith(organizationId, "Customers", ["Staying", "Moving"]);
    const plan = await prisma.contactAttributeKey.create({
      data: { key: "plan", name: "Plan", directoryId, workspaceId: movingId },
    });
    const vip = await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId: movingId, directoryId },
    });

    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [stayingId] });
    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [stayingId, movingId] });

    expect(await prisma.contactAttributeKey.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({
      directoryId,
      workspaceId: movingId,
    });
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: vip.id } })).toMatchObject({
      directoryId,
      workspaceId: movingId,
    });
  });
});

// ADR 0062: archiving is always asked for; an archived directory has no workspaces, an active one may have none.
describe("archiving a directory", () => {
  test("removing its last workspace leaves it active; it can't be archived while it has one", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [workspaceId],
    } = await createDirectoryWith(organizationId, "Customers", ["Only"]);

    await expect(
      updateContactDirectory({ organizationId, directoryId, isArchived: true })
    ).rejects.toBeInstanceOf(ContactDirectoryArchiveHasWorkspacesError);
    expect(await isArchived(directoryId)).toBe(false);

    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [] });

    expect(await isArchived(directoryId)).toBe(false);
    expect(await directoryOf(workspaceId)).toBeNull();
  });

  test("removing its last workspace archives it when the same save asks to", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [workspaceId],
    } = await createDirectoryWith(organizationId, "Customers", ["Only"]);

    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [], isArchived: true });

    expect(await isArchived(directoryId)).toBe(true);
    expect(await directoryOf(workspaceId)).toBeNull();
  });

  test("an archived directory gets workspaces only when the same save unarchives it", async () => {
    const organizationId = await createOrganization();
    const {
      directoryId,
      workspaceIds: [workspaceId],
    } = await createDirectoryWith(organizationId, "Customers", ["Only"]);
    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [], isArchived: true });

    await expect(
      updateContactDirectory({ organizationId, directoryId, workspaceIds: [workspaceId] })
    ).rejects.toBeInstanceOf(ContactDirectoryArchivedError);
    expect(await directoryOf(workspaceId)).toBeNull();
    expect(await isArchived(directoryId)).toBe(true);

    await updateContactDirectory({
      organizationId,
      directoryId,
      workspaceIds: [workspaceId],
      isArchived: false,
    });

    expect(await isArchived(directoryId)).toBe(false);
    expect(await directoryOf(workspaceId)).toBe(directoryId);
  });

  test("an archived directory can be unarchived without a workspace", async () => {
    const organizationId = await createOrganization();
    const { directoryId } = await createDirectoryWith(organizationId, "Customers", ["Only"]);
    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [], isArchived: true });

    await updateContactDirectory({ organizationId, directoryId, isArchived: false });

    expect(await isArchived(directoryId)).toBe(false);
    expect(await prisma.workspace.count({ where: { contactDirectoryId: directoryId } })).toBe(0);
  });

  test("the list keeps an archived directory, marked archived and with no workspaces", async () => {
    const organizationId = await createOrganization();
    const { directoryId } = await createDirectoryWith(organizationId, "Customers", ["Only"]);
    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [], isArchived: true });

    const list = await listContactDirectories(organizationId);

    expect(list.directories).toEqual([
      expect.objectContaining({ id: directoryId, isArchived: true, workspaces: [] }),
    ]);
    expect(list.workspaces).toEqual([expect.objectContaining({ directoryId: null })]);
  });

  test("the list shows an active directory with no workspaces as active", async () => {
    const organizationId = await createOrganization();
    const { directoryId } = await createDirectoryWith(organizationId, "Customers", ["Only"]);
    await updateContactDirectory({ organizationId, directoryId, workspaceIds: [] });

    const list = await listContactDirectories(organizationId);

    expect(list.directories).toEqual([
      expect.objectContaining({ id: directoryId, isArchived: false, workspaces: [] }),
    ]);
  });
});

describe("directory names", () => {
  test("are unique in the organization whatever their case, and a directory can change its own case", async () => {
    const organizationId = await createOrganization();
    const create = async (name: string) =>
      createContactDirectory({
        organizationId,
        name,
        matchingKey: "email",
        workspaceIds: [await createWorkspaceWithoutDirectory(organizationId, name)],
      });
    const northwind = await create("Northwind");
    const acme = await create("Acme");

    await expect(create("  NORTHWIND ")).rejects.toBeInstanceOf(ContactDirectoryNameTakenError);
    await expect(
      updateContactDirectory({ organizationId, directoryId: acme.id, name: "northwind" })
    ).rejects.toBeInstanceOf(ContactDirectoryNameTakenError);
    await updateContactDirectory({ organizationId, directoryId: northwind.id, name: "NorthWind" });

    expect(
      (await prisma.contactDirectory.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map(
        ({ name }) => name
      )
    ).toEqual(["Acme", "NorthWind"]);
  });

  test("a rename waits for another save of the organization's names, then sees its name", async () => {
    const organizationId = await createOrganization();
    const directory = await createContactDirectory({
      organizationId,
      name: "Acme",
      matchingKey: "email",
      workspaceIds: [await createWorkspaceWithoutDirectory(organizationId, "A")],
    });

    // Another save, as the service makes one: it holds the names lock and writes "NORTHWIND", but has
    // not committed yet when the rename to "Northwind" starts.
    let releaseOtherSave = () => {};
    const otherSaveHolds = new Promise<void>((resolve) => {
      releaseOtherSave = resolve;
    });
    let otherSaveStarted = () => {};
    const started = new Promise<void>((resolve) => {
      otherSaveStarted = resolve;
    });
    const otherSave = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"contact-directory-name:" + organizationId}))`;
      await tx.contactDirectory.create({ data: { organizationId, name: "NORTHWIND", matchingKey: "email" } });
      otherSaveStarted();
      await otherSaveHolds;
    });
    await started;

    const rename = updateContactDirectory({ organizationId, directoryId: directory.id, name: "Northwind" });
    // Without the lock the rename would find the name free now, before the other save commits.
    await new Promise((resolve) => setTimeout(resolve, 300));
    releaseOtherSave();
    await otherSave;

    await expect(rename).rejects.toBeInstanceOf(ContactDirectoryNameTakenError);
  });
});
