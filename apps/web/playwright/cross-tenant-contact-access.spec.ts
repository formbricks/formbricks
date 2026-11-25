import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { getDefaultAttributeKeys } from "@/modules/ee/contacts/directories/lib/constants";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-2290 regression: the contact detail page authorized the workspaceId in the URL but loaded the
// contact by contactId alone, so pairing your own workspace with someone else's contact id read that
// contact's attributes (email, userId, arbitrary custom PII), its responses and its displays. Every
// read on this page now goes through getContactAuth, which ties the two ids together and fails
// closed with a 404. The second test guards against a fix that over-blocks and takes the owner's own
// contacts down with it.
//
// ENG-7495: contacts now live in contact directories, and a workspace sees every contact of its
// directory. The "Contact directories" tests cover the two sides of that: a contact of another
// directory in the same organization stays a 404, and a contact of a shared directory opens from every
// workspace on it while each workspace still sees only its own surveys' responses and displays.

const getContactDirectoryId = async (workspaceId: string): Promise<string> => {
  const { contactDirectoryId } = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { contactDirectoryId: true },
  });
  if (!contactDirectoryId) {
    throw new Error("The users fixture should give the workspace a contact directory");
  }
  return contactDirectoryId;
};

/** A second workspace in the organization, on `directoryId`, or on a new directory of its own. */
const addWorkspace = async (organizationId: string, label: string, directoryId?: string) => {
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace ${Date.now()}`, organizationId },
    select: { id: true, name: true },
  });

  let contactDirectoryId = directoryId;
  if (!contactDirectoryId) {
    const directory = await prisma.contactDirectory.create({
      data: { organizationId, name: workspace.name, matchingKey: "email" },
      select: { id: true },
    });
    contactDirectoryId = directory.id;
    await prisma.contactAttributeKey.createMany({
      data: getDefaultAttributeKeys("email").map((key) => ({
        ...key,
        type: "default" as const,
        directoryId: directory.id,
        workspaceId: workspace.id,
      })),
    });
  }

  await prisma.workspace.update({ where: { id: workspace.id }, data: { contactDirectoryId } });
  return workspace.id;
};

/** A contact created in `workspaceId`, in its directory, with default and custom PII attributes. */
const seedContact = async (workspaceId: string, directoryId: string, label: string) => {
  const contact = await prisma.contact.create({ data: { workspaceId, directoryId } });

  // The directory has the default attribute keys (email, firstName, lastName, userId); add a custom
  // one so the tests also cover operator-uploaded PII.
  const keys = await prisma.contactAttributeKey.findMany({
    where: { directoryId },
    select: { id: true, key: true },
  });
  const customKey = await prisma.contactAttributeKey.upsert({
    where: { directoryId_key: { directoryId, key: "plan" } },
    create: { workspaceId, directoryId, name: "Plan", key: "plan", type: "custom" },
    update: {},
    select: { id: true },
  });

  // Unique per contact and per run, so an assertion on the page HTML cannot pass by accident.
  const pii = {
    email: `${label}-pii-${Date.now()}@example.com`,
    userId: `${label}-user-${Date.now()}`,
    plan: `${label}-secret-plan-${Date.now()}`,
    answer: `${label}-answer-${Date.now()}`,
  };

  const keyId = (key: string) => keys.find((k) => k.key === key)?.id;

  await prisma.contactAttribute.createMany({
    data: [
      { contactId: contact.id, attributeKeyId: keyId("email")!, value: pii.email },
      { contactId: contact.id, attributeKeyId: keyId("userId")!, value: pii.userId },
      { contactId: contact.id, attributeKeyId: customKey.id, value: pii.plan },
    ],
  });

  return { contactId: contact.id, pii };
};

/** One display and one finished response by the contact on the survey. */
const seedActivity = async (surveyId: string, contactId: string, answer: string) => {
  await prisma.display.create({ data: { surveyId, contactId } });
  await prisma.response.create({
    data: { surveyId, contactId, finished: true, data: { q1: answer } },
  });
};

const createSurvey = async (workspaceId: string, createdBy: string, label: string) =>
  prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: `${label} Survey ${Date.now()}`,
      status: "inProgress",
      type: "link",
    },
    select: { id: true, name: true },
  });

const seedTenant = async (users: UsersFixture, label: string) => {
  const user = await users.create({ organizationName: `${label} Org` });

  if (!user.workspaceId) {
    throw new Error("Workspace not seeded for test");
  }

  const workspaceId = user.workspaceId;
  const directoryId = await getContactDirectoryId(workspaceId);
  const { contactId, pii } = await seedContact(workspaceId, directoryId, label);

  // Give the contact activity too, so the response/display loaders are exercised, not just the
  // attribute one.
  const survey = await prisma.survey.findFirstOrThrow({ where: { workspaceId }, select: { id: true } });
  await seedActivity(survey.id, contactId, pii.answer);

  return { user, workspaceId, directoryId, contactId, pii };
};

const gotoContact = (page: Page, workspaceId: string, contactId: string) =>
  page.goto(`/workspaces/${workspaceId}/contacts/${contactId}`, { waitUntil: "domcontentloaded" });

/**
 * Asserts against the full document rather than visible text: this also catches PII serialized into
 * the RSC flight payload but never painted. The contact id itself is deliberately not asserted on — it
 * is the caller's own input and Next echoes the request path back in the router state.
 */
const expectNoneInDocument = async (page: Page, values: Record<string, string>, owner: string) => {
  const html = await page.content();
  for (const [field, value] of Object.entries(values)) {
    expect(html, `the page must not expose ${owner}'s ${field}`).not.toContain(value);
  }
};

/** The number shown under a label ("Responses", "Displays") in the contact's attributes column. */
const attributeCount = (page: Page, label: string) =>
  page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd");

test.describe("Cross-tenant contact access (ENG-2290)", () => {
  test("404s when a foreign contact id is paired with an authorized workspace", async ({ page, users }) => {
    const victim = await seedTenant(users, "victim");
    const attacker = await seedTenant(users, "attacker");

    await attacker.user.login();

    await gotoContact(page, attacker.workspaceId, victim.contactId);

    await expect(page.getByTestId("error-code")).toHaveText("404");
    await expectNoneInDocument(page, victim.pii, "the victim");
  });

  test("keeps access to the workspace's own contacts", async ({ page, users }) => {
    const owner = await seedTenant(users, "owner");

    await owner.user.login();

    await gotoContact(page, owner.workspaceId, owner.contactId);

    await expect(page.getByRole("heading", { name: owner.pii.email })).toBeVisible();
    await expect(page.getByText(owner.pii.userId)).toBeVisible();
    await expect(page.getByText(owner.pii.plan)).toBeVisible();
  });
});

test.describe("Contact directories (ENG-7495)", () => {
  test("404s for a contact of another directory in the same organization", async ({ page, users }) => {
    const tenant = await seedTenant(users, "dir-a");
    const otherWorkspaceId = await addWorkspace(tenant.user.organizationId, "dir-b");
    const otherDirectoryId = await getContactDirectoryId(otherWorkspaceId);
    const other = await seedContact(otherWorkspaceId, otherDirectoryId, "dir-b");

    await tenant.user.login();

    // The owner may open both workspaces, but the contact is only in the second one's directory.
    await gotoContact(page, tenant.workspaceId, other.contactId);
    await expect(page.getByTestId("error-code")).toHaveText("404");
    await expectNoneInDocument(page, other.pii, "the other directory's contact");

    // Control: the same contact opens from its own workspace, so the 404 is the directory boundary and
    // not a broken seed.
    await gotoContact(page, otherWorkspaceId, other.contactId);
    await expect(page.getByRole("heading", { name: other.pii.email })).toBeVisible();
  });

  test("a shared directory's contact opens in every workspace, with only that workspace's activity", async ({
    page,
    users,
  }) => {
    const user = await users.create({ organizationName: "shared-dir Org", skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("Workspace not seeded for test");
    const workspaceA = user.workspaceId;
    const directoryId = await getContactDirectoryId(workspaceA);
    await prisma.contactDirectory.update({
      where: { id: directoryId },
      data: { name: `Shared ${Date.now()}` },
    });
    const workspaceB = await addWorkspace(user.organizationId, "shared-b", directoryId);

    // The contact is created in A; both workspaces then collect activity from it on their own surveys.
    const { contactId, pii } = await seedContact(workspaceA, directoryId, "shared");
    const surveyA = await createSurvey(workspaceA, user.id, "shared-a");
    const surveyB = await createSurvey(workspaceB, user.id, "shared-b");
    const answerA = `shared-a-answer-${Date.now()}`;
    const answerB = `shared-b-answer-${Date.now()}`;
    await seedActivity(surveyA.id, contactId, answerA);
    await seedActivity(surveyB.id, contactId, answerB);

    await user.login();

    // In B: the contact and every attribute, including the custom one, are there.
    await gotoContact(page, workspaceB, contactId);
    await expect(page.getByRole("heading", { name: pii.email })).toBeVisible();
    await expect(page.getByText(pii.userId)).toBeVisible();
    await expect(page.getByText(pii.plan)).toBeVisible();

    // B's own survey shows up twice in the timeline (its display and its response); A's not at all.
    await expect(page.getByRole("link", { name: surveyB.name })).toHaveCount(2);
    await expect(attributeCount(page, "Responses")).toHaveText("1");
    await expect(attributeCount(page, "Displays")).toHaveText("1");
    await expectNoneInDocument(page, { surveyName: surveyA.name, answer: answerA }, "workspace A");

    // And the other way round in A.
    await gotoContact(page, workspaceA, contactId);
    await expect(page.getByRole("heading", { name: pii.email })).toBeVisible();
    await expect(page.getByRole("link", { name: surveyA.name })).toHaveCount(2);
    await expect(attributeCount(page, "Responses")).toHaveText("1");
    await expect(attributeCount(page, "Displays")).toHaveText("1");
    await expectNoneInDocument(page, { surveyName: surveyB.name, answer: answerB }, "workspace B");
  });

  test("deleting a shared directory's contact is refused and the contact stays", async ({ page, users }) => {
    const user = await users.create({ organizationName: "shared-delete Org", skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("Workspace not seeded for test");
    const directoryId = await getContactDirectoryId(user.workspaceId);
    const directoryName = `Shared delete ${Date.now()}`;
    await prisma.contactDirectory.update({
      where: { id: directoryId },
      data: { name: directoryName },
    });
    const workspaceB = await addWorkspace(user.organizationId, "shared-delete-b", directoryId);
    const { contactId, pii } = await seedContact(user.workspaceId, directoryId, "shared-delete");

    await user.login();
    await gotoContact(page, workspaceB, contactId);
    await expect(page.getByRole("heading", { name: pii.email })).toBeVisible();

    // The dialog says why up front and offers no Delete.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText(`${directoryName} is shared with other workspaces, so its contacts can't be deleted.`)
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Delete" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    // The server refuses it too, for a caller that skips the dialog.
    const response = await page.request.delete(
      `/api/internal/contacts/${contactId}?workspaceId=${workspaceB}`,
      { headers: { Origin: new URL(page.url()).origin } }
    );
    expect(response.status()).toBe(403);
    expect(await prisma.contact.count({ where: { id: contactId } })).toBe(1);
  });
});
