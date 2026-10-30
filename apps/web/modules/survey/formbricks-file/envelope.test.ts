import { describe, expect, test } from "vitest";
import { FORMBRICKS_FILE_V1_SCHEMA_URL, ZFormbricksFileV1, getFormbricksFileV1JsonSchema } from "./envelope";
import { FORMBRICKS_FILE_MAX_ACTION_CLASSES, FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS } from "./limits";

/**
 * The published JSON Schema is generated from the envelope's Zod schema and committed under
 * `docs/schemas/`, where the docs serve it at the URL every file names in `$schema`. This test is the
 * drift check: it fails in CI when the schema and the committed file differ.
 *
 * Regenerate after changing the envelope or the v3 create body: `pnpm --filter @formbricks/web formbricks-file:schema`.
 */
const PUBLISHED_SCHEMA_PATH = "../../../../../docs/schemas/formbricks-file/v1.json";

const validFile = () => ({
  $schema: FORMBRICKS_FILE_V1_SCHEMA_URL,
  formbricks: {
    format: 1,
    exportedAt: "2026-10-30T12:00:00.000Z",
    appVersion: "6.2.0",
    source: {
      surveyId: "clsurvey0000000000000001",
      workspaceId: "clworkspace0000000000001",
      updatedAt: "2026-10-29T11:30:00.000Z",
    },
  },
  survey: {
    name: "Onboarding NPS",
    blocks: [
      {
        id: "clblock00000000000000001",
        name: "Block 1",
        elements: [{ id: "nps", type: "nps", headline: { "en-US": "How likely?" }, required: true }],
      },
    ],
  },
  references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
});

describe("ZFormbricksFileV1", () => {
  test("accepts a format 1 file", () => {
    expect(ZFormbricksFileV1.safeParse(validFile()).error?.issues).toBeUndefined();
  });

  test("refuses a newer format, a source URL, and a survey with server-owned fields", () => {
    const newer = validFile();
    newer.formbricks.format = 2;
    expect(ZFormbricksFileV1.safeParse(newer).success).toBe(false);

    const withUrl = validFile();
    expect(
      ZFormbricksFileV1.safeParse({
        ...withUrl,
        formbricks: { ...withUrl.formbricks, source: { ...withUrl.formbricks.source, url: "https://x" } },
      }).success
    ).toBe(false);

    const withId = validFile();
    expect(
      ZFormbricksFileV1.safeParse({ ...withId, survey: { ...withId.survey, id: "clsurvey0000000000000001" } })
        .success
    ).toBe(false);
  });

  test("caps each kind of reference at what one survey can point at", () => {
    const actionClass = {
      id: "claction0000000000000001",
      name: "Checkout",
      description: null,
      type: "code",
      key: "checkout",
      noCodeConfig: null,
    };
    const attributeKey = { key: "plan", name: null, description: null, dataType: "string" };
    const withReferences = (actionClasses: number, attributeKeys: number) => ({
      ...validFile(),
      references: {
        actionClasses: Array.from({ length: actionClasses }, () => actionClass),
        attributeKeys: Array.from({ length: attributeKeys }, () => attributeKey),
        embeddedFields: [],
      },
    });

    expect(
      ZFormbricksFileV1.safeParse(
        withReferences(FORMBRICKS_FILE_MAX_ACTION_CLASSES, FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS)
      ).success
    ).toBe(true);
    expect(
      ZFormbricksFileV1.safeParse(withReferences(FORMBRICKS_FILE_MAX_ACTION_CLASSES + 1, 0)).success
    ).toBe(false);
    expect(
      ZFormbricksFileV1.safeParse(withReferences(0, FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS + 1)).success
    ).toBe(false);
  });
});

describe("getFormbricksFileV1JsonSchema", () => {
  test("names itself by the URL files point at, and closes the envelope and the survey to unknown keys", () => {
    const schema = getFormbricksFileV1JsonSchema();
    const definitions = (schema.$defs ?? {}) as Record<string, Record<string, unknown>>;
    // Follows `#/$defs/…` references down to the schema they name.
    const resolve = (node: Record<string, unknown>): Record<string, unknown> =>
      typeof node.$ref === "string" ? resolve(definitions[node.$ref.replace("#/$defs/", "")]) : node;
    const properties = schema.properties as Record<string, Record<string, unknown>>;

    expect(schema).toMatchObject({
      $id: FORMBRICKS_FILE_V1_SCHEMA_URL,
      type: "object",
      required: ["formbricks", "survey", "references"],
      additionalProperties: false,
    });
    const meta = resolve(properties.formbricks);
    expect(meta).toMatchObject({ additionalProperties: false });
    expect(resolve((meta.properties as Record<string, Record<string, unknown>>).format)).toMatchObject({
      const: 1,
    });
    expect(resolve(properties.survey)).toMatchObject({
      required: ["name", "blocks"],
      additionalProperties: false,
    });
    expect(resolve(properties.references)).toMatchObject({
      required: ["actionClasses", "attributeKeys", "embeddedFields"],
      additionalProperties: false,
    });
  });

  test("matches the schema published with the docs", async () => {
    await expect(`${JSON.stringify(getFormbricksFileV1JsonSchema(), null, 2)}\n`).toMatchFileSnapshot(
      PUBLISHED_SCHEMA_PATH
    );
  });
});
