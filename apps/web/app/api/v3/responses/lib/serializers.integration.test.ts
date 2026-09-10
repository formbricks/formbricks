import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { ZV3ResponseListItem, ZV3ResponseResource } from "./resources";
import { createV3ResponseSerializer } from "./serializers";
import { getV3ResponseSurveys, v3ResponseReadSelect } from "./service";

/**
 * The read path against a real Postgres, end to end minus HTTP.
 *
 * The unit tests feed hand-built objects to each module. That proves the rules but not that they
 * survive contact with Prisma: the selects, the JSON columns, the relation shapes and the enum
 * values are all decided by the database, and every one of them is a place where a hand-built
 * fixture can be wrong in the same direction as the code. This drives real rows through the real
 * selects into the real serializer, then parses the result with the **contract mirror itself** —
 * which is `.strict()`, so a field the spec does not declare fails here rather than in production.
 *
 * It also pins the two promises the contract makes about disclosure, at the only layer that can
 * really check them: whatever the serializer emits is what a client sees.
 */

const IP = "203.0.113.77";
const SU_TOKEN = "single-use-secret-token";

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "Smoke Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Smoke Workspace", organizationId: organization.id },
  });

  const [english, german] = await Promise.all([
    prisma.language.create({ data: { code: "en", workspaceId: workspace.id } }),
    prisma.language.create({ data: { code: "de", workspaceId: workspace.id } }),
  ]);

  const survey = await prisma.survey.create({
    data: {
      name: "Smoke Survey",
      workspaceId: workspace.id,
      blocks: [
        {
          id: "blk1",
          name: "Block",
          elements: [
            {
              id: "q1",
              type: "openText",
              headline: { default: "How satisfied?", de: "Wie zufrieden?" },
              required: false,
            },
            {
              id: "q2",
              type: "multipleChoiceSingle",
              headline: { default: "Which plan?" },
              required: false,
              choices: [
                { id: "c1", label: { default: "Free" } },
                { id: "c2", label: { default: "Pro" } },
              ],
            },
            {
              id: "q3",
              type: "address",
              headline: { default: "Where?" },
              required: false,
              addressLine1: { show: true, required: false, placeholder: { default: "Line 1" } },
              addressLine2: { show: true, required: false, placeholder: { default: "Line 2" } },
              city: { show: true, required: false, placeholder: { default: "City" } },
              state: { show: true, required: false, placeholder: { default: "State" } },
              zip: { show: true, required: false, placeholder: { default: "Zip" } },
              country: { show: true, required: false, placeholder: { default: "Country" } },
            },
          ],
        },
      ],
      languages: {
        create: [
          { languageId: english.id, default: true },
          { languageId: german.id, default: false },
        ],
      },
    },
  });

  // Two declared hidden fields and one variable. `q1` is declared on purpose: it collides with an
  // element id, which is the state only the v1 management API can still author (ENG-3142).
  const declare = async (
    name: string,
    source: "ingested" | "computed",
    storageKey: string,
    order: number
  ) => {
    const field = await prisma.embeddedData.create({
      data: { name, source, dataType: "string", workspaceId: workspace.id, surveyId: survey.id },
    });
    await prisma.surveyEmbeddedData.create({
      data: {
        workspaceId: workspace.id,
        surveyId: survey.id,
        embeddedDataId: field.id,
        storageKey,
        order,
      },
    });
    return field;
  };

  await declare("plan", "ingested", "plan", 1);
  await declare("q1", "ingested", "q1", 2);
  const scoreVariable = await declare("score", "computed", "will-be-replaced", 3);
  // A variable's storage key is its own cuid — the split the read deliberately hides.
  await prisma.surveyEmbeddedData.update({
    where: { surveyId_embeddedDataId: { surveyId: survey.id, embeddedDataId: scoreVariable.id } },
    data: { storageKey: scoreVariable.id },
  });

  const attributeKey = await prisma.contactAttributeKey.create({
    data: { key: "userId", workspaceId: workspace.id },
  });
  const secretKey = await prisma.contactAttributeKey.create({
    data: { key: "email", workspaceId: workspace.id },
  });
  const contact = await prisma.contact.create({ data: { workspaceId: workspace.id } });
  await prisma.contactAttribute.createMany({
    data: [
      { contactId: contact.id, attributeKeyId: attributeKey.id, value: "user-77" },
      { contactId: contact.id, attributeKeyId: secretKey.id, value: "respondent@example.test" },
    ],
  });

  const tag = await prisma.tag.create({ data: { name: "vip", workspaceId: workspace.id } });

  const response = await prisma.response.create({
    data: {
      surveyId: survey.id,
      finished: true,
      language: "de",
      contactId: contact.id,
      data: {
        q1: "the respondent's own answer",
        q2: "Pro",
        q3: ["Ackerstr. 1", "", "Berlin", "", "10115", "Deutschland"],
        plan: "enterprise",
      },
      variables: { [scoreVariable.id]: "42" },
      ttc: { q1: 1500, q2: 2500, _total: 99000 },
      meta: {
        source: "link",
        url: `https://app.test/s/abc?suToken=${SU_TOKEN}&utm_source=x`,
        country: "DE",
        ipAddress: IP,
        userAgent: { browser: "Firefox", os: "Linux", device: "desktop" },
      },
      tags: { create: [{ tagId: tag.id }] },
    },
  });

  return { workspaceId: workspace.id, surveyId: survey.id, responseId: response.id };
};

const readAndSerialize = async (responseId: string) => {
  const row = await prisma.response.findUniqueOrThrow({
    where: { id: responseId },
    select: v3ResponseReadSelect,
  });
  const surveys = await getV3ResponseSurveys([row.surveyId]);
  const survey = surveys.get(row.surveyId);
  if (!survey) throw new Error("survey missing");

  const serializer = createV3ResponseSerializer();
  return { listItem: serializer.toListItem(row, survey), resource: serializer.toResource(row, survey) };
};

describe("the v3 read path against real Postgres", () => {
  let seeded: Awaited<ReturnType<typeof seed>>;

  beforeEach(async () => {
    await resetDb();
    seeded = await seed();
  });

  /**
   * The contract mirror is `.strict()`, so this fails on a field the spec does not declare as well
   * as on one it declares differently. It is the single strongest assertion in the file.
   */
  test("both views satisfy the contract mirror", async () => {
    const { listItem, resource } = await readAndSerialize(seeded.responseId);

    expect(() => ZV3ResponseListItem.parse(listItem)).not.toThrow();
    expect(() => ZV3ResponseResource.parse(resource)).not.toThrow();
  });

  test("the envelope is drawn from the survey, not invented", async () => {
    const { listItem } = await readAndSerialize(seeded.responseId);

    expect(listItem).toMatchObject({
      id: seeded.responseId,
      surveyId: seeded.surveyId,
      surveyName: "Smoke Survey",
      workspaceId: seeded.workspaceId,
      finished: true,
      language: "de",
    });
    expect(listItem.tags).toEqual([{ id: expect.any(String), name: "vip" }]);
  });

  /**
   * The contract promises the respondent's IP is not part of this resource in any view. Asserted
   * over the serialized bytes rather than a named field, so a future path that reintroduces it
   * anywhere — a catalog entry, a meta echo, an unresolved rawValue — fails here.
   */
  test("no view carries the respondent's IP address, in any field", async () => {
    const { listItem, resource } = await readAndSerialize(seeded.responseId);

    for (const view of [listItem, resource]) {
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain(IP);
      expect(serialized).not.toContain("ipAddress");
    }
  });

  /** The single-use link credential lives in the stored url. Publishing it would leak the link. */
  test("no view carries the single-use token from the stored url", async () => {
    const { listItem, resource } = await readAndSerialize(seeded.responseId);

    for (const view of [listItem, resource]) {
      expect(JSON.stringify(view)).not.toContain(SU_TOKEN);
    }
    expect(listItem.embeddedData.find((e) => e.key === "url")?.value).toBe("https://app.test/s/abc");
  });

  /**
   * `contactAttributes` is a stale PII snapshot v1/v2 expose and v3 does not. The select scopes the
   * relation to the `userId` key; this proves the scoping holds against a contact that really does
   * carry another attribute.
   */
  test("the contact carries userId and no other attribute", async () => {
    const { resource } = await readAndSerialize(seeded.responseId);

    expect(resource.contact).toEqual({ id: expect.any(String), userId: "user-77" });
    expect(JSON.stringify(resource)).not.toContain("respondent@example.test");
  });

  /**
   * The collision the ingest contract settles: a question answer owns the address, so a hidden
   * field declared under an element id can never hold a value. The answer must be an answer.
   */
  test("a hidden field declared under an element id does not capture that element's answer", async () => {
    const { listItem } = await readAndSerialize(seeded.responseId);

    const q1 = listItem.answers.find((answer) => answer.elementId === "q1");
    expect(q1).toMatchObject({ valueText: "the respondent's own answer" });
    expect(listItem.embeddedData.map((entry) => entry.key)).not.toContain("q1");
    expect(listItem.unresolved).toEqual([]);
  });

  test("hidden fields and variables are keyed by name, never by storage key", async () => {
    const { listItem } = await readAndSerialize(seeded.responseId);
    const byKey = Object.fromEntries(listItem.embeddedData.map((entry) => [entry.key, entry]));

    expect(byKey.plan).toMatchObject({ kind: "ingested", value: "enterprise" });
    expect(byKey.score).toMatchObject({ kind: "computed" });
    expect(listItem.embeddedData.some((entry) => entry.key.startsWith("c"))).toBe(false);
  });

  test("labels resolve in the language the response was collected in", async () => {
    const { listItem } = await readAndSerialize(seeded.responseId);

    expect(listItem.answers.find((a) => a.elementId === "q1")?.elementLabel).toBe("Wie zufrieden?");
    expect(listItem.resolution.labelsLanguage).toBe("de");
  });

  /** Positional slots, blanks preserved — the shape a fixture is easiest to get wrong. */
  test("an address answer keeps its positional slots", async () => {
    const { listItem } = await readAndSerialize(seeded.responseId);
    const address = listItem.answers.find((answer) => answer.elementId === "q3");

    expect(address && "fields" in address ? address.fields.map((f) => f.valueText) : null).toEqual([
      "Ackerstr. 1",
      "",
      "Berlin",
      "",
      "10115",
      "Deutschland",
    ]);
  });

  test("durationSeconds sums the element buckets and ignores the stored total", async () => {
    const { listItem } = await readAndSerialize(seeded.responseId);

    expect(listItem.durationSeconds).toBe(4);
  });

  /** The detail view returns the stored map verbatim, because it is what PATCH accepts. */
  test("the detail view returns the stored data map unchanged", async () => {
    const { resource } = await readAndSerialize(seeded.responseId);

    expect(resource.data).toEqual({
      q1: "the respondent's own answer",
      q2: "Pro",
      q3: ["Ackerstr. 1", "", "Berlin", "", "10115", "Deutschland"],
      plan: "enterprise",
    });
  });
});
