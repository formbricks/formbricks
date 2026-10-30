import { describe, expect, test, vi } from "vitest";
import { V3_SURVEY_MAX_LANGUAGES } from "@/app/api/v3/surveys/schemas";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { SurveyImportFileTooLargeError } from "@/modules/survey/import/core/errors";
import { FORMBRICKS_FILE_V1_SCHEMA_URL } from "./envelope";
import {
  FORMBRICKS_FILE_MAX_ACTION_CLASSES,
  FORMBRICKS_FILE_MAX_APP_VERSION_CHARS,
  FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS,
  FORMBRICKS_FILE_MAX_DEFAULT_VALUE_CHARS,
  FORMBRICKS_FILE_MAX_DESCRIPTION_CHARS,
  FORMBRICKS_FILE_MAX_EMBEDDED_FIELDS,
  FORMBRICKS_FILE_MAX_KEY_CHARS,
  FORMBRICKS_FILE_MAX_LANGUAGE_CODE_CHARS,
  FORMBRICKS_FILE_MAX_NAME_CHARS,
  FORMBRICKS_FILE_MAX_NO_CODE_CONFIG_CHARS,
  FORMBRICKS_FILE_MAX_REPORTED_DROPPED_KEYS,
  FORMBRICKS_FILE_MAX_SCHEMA_URL_CHARS,
  FORMBRICKS_FILE_MAX_SURVEY_BYTES,
} from "./limits";
import { readFormbricksFile, readFormbricksFileContent, upgradeFormbricksFile } from "./read";

vi.mock("server-only", () => ({}));

const ACTION_CLASS_ID = "claction0000000000000001";

const survey = () => ({
  name: "Onboarding NPS",
  type: "link",
  defaultLanguage: "en-US",
  languages: [
    { code: "en-US", default: true, enabled: true },
    { code: "de-DE", default: false, enabled: true },
  ],
  blocks: [
    {
      id: "clblock00000000000000001",
      name: "Block 1",
      elements: [
        {
          id: "nps",
          type: "nps",
          headline: { "en-US": "How likely?", "de-DE": "Wie wahrscheinlich?" },
          required: true,
        },
      ],
    },
  ],
});

const references = () => ({ actionClasses: [], attributeKeys: [], embeddedFields: [] });

const file = (overrides: Record<string, unknown> = {}) => ({
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
  survey: survey(),
  references: references(),
  ...overrides,
});

/** The refusal a read throws, for its problem code and params. */
const refusalOf = (read: () => unknown): SurveyImportInputError => {
  try {
    read();
  } catch (error) {
    if (error instanceof SurveyImportInputError) return error;
    throw error;
  }
  throw new Error("Expected the read to refuse the file");
};

describe("each string a Formbricks file's envelope and references carry", () => {
  /** A text of `length` characters. */
  const text = (length: number) => "x".repeat(length);
  /** A no-code configuration whose JSON is exactly `chars` characters. */
  const noCodeConfigOf = (chars: number) => {
    const empty = { type: "pageView", urlFilters: [{ rule: "contains", value: "" }] };
    const padding = chars - JSON.stringify(empty).length;
    return { type: "pageView", urlFilters: [{ rule: "contains", value: `/${text(padding - 1)}` }] };
  };
  const actionClass = (overrides: Record<string, unknown> = {}) => ({
    id: ACTION_CLASS_ID,
    name: "Checkout",
    description: null,
    type: "code",
    key: "checkout",
    noCodeConfig: null,
    ...overrides,
  });
  const attributeKey = (overrides: Record<string, unknown> = {}) => ({
    key: "plan",
    name: "Plan",
    description: null,
    dataType: "string",
    ...overrides,
  });
  const embeddedField = (overrides: Record<string, unknown> = {}) => ({
    storageKey: "plan_tier",
    key: "plan_tier",
    name: "Plan tier",
    source: "ingested",
    dataType: "string",
    defaultValue: null,
    locked: false,
    ...overrides,
  });
  const withReferences = (overrides: Record<string, unknown>) =>
    file({ references: { ...references(), ...overrides } });
  const withMeta = (overrides: Record<string, unknown>) =>
    file({ formbricks: { ...file().formbricks, ...overrides } });

  // Each case: the field the refusal names, its cap, and the file with that field at a given length.
  const cases: [string, number, (length: number) => Record<string, unknown>][] = [
    ["file.$schema", FORMBRICKS_FILE_MAX_SCHEMA_URL_CHARS, (length) => file({ $schema: text(length) })],
    [
      "file.formbricks.appVersion",
      FORMBRICKS_FILE_MAX_APP_VERSION_CHARS,
      (length) => withMeta({ appVersion: text(length) }),
    ],
    [
      "file.references.actionClasses.0.name",
      FORMBRICKS_FILE_MAX_NAME_CHARS,
      (length) => withReferences({ actionClasses: [actionClass({ name: text(length) })] }),
    ],
    [
      "file.references.actionClasses.0.description",
      FORMBRICKS_FILE_MAX_DESCRIPTION_CHARS,
      (length) => withReferences({ actionClasses: [actionClass({ description: text(length) })] }),
    ],
    [
      "file.references.actionClasses.0.key",
      FORMBRICKS_FILE_MAX_KEY_CHARS,
      (length) => withReferences({ actionClasses: [actionClass({ key: text(length) })] }),
    ],
    [
      "file.references.actionClasses.0.noCodeConfig",
      FORMBRICKS_FILE_MAX_NO_CODE_CONFIG_CHARS,
      (length) =>
        withReferences({
          actionClasses: [actionClass({ type: "noCode", key: null, noCodeConfig: noCodeConfigOf(length) })],
        }),
    ],
    [
      "file.references.attributeKeys.0.key",
      FORMBRICKS_FILE_MAX_KEY_CHARS,
      (length) => withReferences({ attributeKeys: [attributeKey({ key: text(length) })] }),
    ],
    [
      "file.references.attributeKeys.0.name",
      FORMBRICKS_FILE_MAX_NAME_CHARS,
      (length) => withReferences({ attributeKeys: [attributeKey({ name: text(length) })] }),
    ],
    [
      "file.references.attributeKeys.0.description",
      FORMBRICKS_FILE_MAX_DESCRIPTION_CHARS,
      (length) => withReferences({ attributeKeys: [attributeKey({ description: text(length) })] }),
    ],
    [
      "file.references.embeddedFields.0.storageKey",
      FORMBRICKS_FILE_MAX_KEY_CHARS,
      (length) => withReferences({ embeddedFields: [embeddedField({ storageKey: text(length) })] }),
    ],
    [
      "file.references.embeddedFields.0.key",
      FORMBRICKS_FILE_MAX_KEY_CHARS,
      (length) => withReferences({ embeddedFields: [embeddedField({ key: text(length) })] }),
    ],
    [
      "file.references.embeddedFields.0.name",
      FORMBRICKS_FILE_MAX_NAME_CHARS,
      (length) => withReferences({ embeddedFields: [embeddedField({ name: text(length) })] }),
    ],
    [
      "file.references.embeddedFields.0.defaultValue",
      FORMBRICKS_FILE_MAX_DEFAULT_VALUE_CHARS,
      (length) => withReferences({ embeddedFields: [embeddedField({ defaultValue: text(length) })] }),
    ],
    [
      "file.references.languages.0.code",
      FORMBRICKS_FILE_MAX_LANGUAGE_CODE_CHARS,
      (length) => withReferences({ languages: [{ code: text(length), alias: "German" }] }),
    ],
    [
      "file.references.languages.0.alias",
      FORMBRICKS_FILE_MAX_NAME_CHARS,
      (length) => withReferences({ languages: [{ code: "de-DE", alias: text(length) }] }),
    ],
  ];

  test.each(cases)(
    "%s is read at its cap, and refused one past it with a 422 naming it",
    (name, cap, fileWith) => {
      expect(() => readFormbricksFile(fileWith(cap))).not.toThrow();

      const refusal = refusalOf(() => readFormbricksFile(fileWith(cap + 1)));

      expect(refusal.problemCode).toBe("formbricks_file_invalid");
      expect(refusal.invalidParams).toEqual([expect.objectContaining({ name })]);
    }
  );

  test("the reviewed content sent back is held to the same caps, named from the request body", () => {
    const body = {
      survey: survey(),
      references: {
        ...references(),
        attributeKeys: [attributeKey({ key: text(FORMBRICKS_FILE_MAX_KEY_CHARS + 1) })],
      },
    };

    const refusal = refusalOf(() => readFormbricksFileContent(body));

    expect(refusal.invalidParams).toEqual([
      expect.objectContaining({ name: "references.attributeKeys.0.key" }),
    ]);
  });
});

describe("readFormbricksFile", () => {
  test("reads a format 1 file: the survey as its create body, its references, no report lines", () => {
    const read = readFormbricksFile(file());

    expect(read.content.survey).toEqual(survey());
    expect(read.content.references).toEqual(references());
    expect(read.issues).toEqual([]);
  });

  test("refuses a file from a newer Formbricks, naming the format it has", () => {
    const refusal = refusalOf(() =>
      readFormbricksFile(file({ formbricks: { ...file().formbricks, format: 2 } }))
    );

    expect(refusal.problemCode).toBe("formbricks_file_too_new");
    expect(refusal.invalidParams).toEqual([
      expect.objectContaining({ name: "file.formbricks.format", identifier: "2" }),
    ]);
  });

  test.each([
    ["no format", undefined],
    ["format 0", 0],
    ["a fractional format", 1.5],
    ["a format as text", "1"],
  ])("refuses %s as malformed", (_label, format) => {
    const refusal = refusalOf(() =>
      readFormbricksFile(file({ formbricks: { ...file().formbricks, format } }))
    );

    expect(refusal.problemCode).toBe("formbricks_file_invalid");
    expect(refusal.invalidParams).toEqual([expect.objectContaining({ name: "file.formbricks.format" })]);
  });

  test("drops every key the format does not know, wherever it is, with one warning each", () => {
    const edited = file({ comment: "made with ChatGPT" });
    edited.formbricks = { ...edited.formbricks, editedBy: "ChatGPT" } as typeof edited.formbricks;
    const withExtras = {
      ...edited,
      survey: {
        ...survey(),
        theme: "dark",
        blocks: [
          {
            ...survey().blocks[0],
            elements: [{ ...survey().blocks[0].elements[0], tooltip: "Pick a number" }],
          },
        ],
      },
      references: { ...references(), segments: [] },
    };

    const read = readFormbricksFile(withExtras);

    expect(read.content.survey).toEqual(survey());
    expect(read.content.references).toEqual(references());
    expect(read.issues.map((issue) => issue.params?.field).sort()).toEqual(
      [
        "comment",
        "formbricks.editedBy",
        "references.segments",
        "survey.blocks.0.elements.0.tooltip",
        "survey.theme",
      ].sort()
    );
    expect(read.issues.every((issue) => issue.code === "unknown_key_dropped")).toBe(true);
    expect(read.issues.every((issue) => issue.severity === "warning")).toBe(true);
  });

  test("drops the share metadata an older file carries, with one warning", () => {
    const read = readFormbricksFile(
      file({ survey: { ...survey(), metadata: { title: { "en-US": "Share title" }, ogImage: "https://x" } } })
    );

    expect(read.content.survey).toEqual(survey());
    expect(read.issues).toEqual([
      { code: "unknown_key_dropped", severity: "warning", params: { field: "survey.metadata" } },
    ]);
  });

  test("names the first fifty dropped keys and counts the rest in one line", () => {
    const extraKeys = Object.fromEntries(
      Array.from({ length: FORMBRICKS_FILE_MAX_REPORTED_DROPPED_KEYS + 7 }, (_, index) => [
        `x${index}`,
        index,
      ])
    );

    const read = readFormbricksFile(file({ survey: { ...survey(), ...extraKeys } }));

    expect(read.issues).toHaveLength(FORMBRICKS_FILE_MAX_REPORTED_DROPPED_KEYS + 1);
    expect(read.issues.at(-1)).toEqual({
      code: "unknown_key_dropped",
      severity: "warning",
      params: { count: 7 },
    });
  });

  test("refuses a malformed survey, naming each field from the file's root, and drops nothing quietly", () => {
    const broken = survey();
    const [element] = broken.blocks[0].elements as Record<string, unknown>[];
    delete element.headline;
    delete element.required;

    const refusal = refusalOf(() => readFormbricksFile(file({ survey: broken, extra: true })));

    expect(refusal.problemCode).toBe("formbricks_file_invalid");
    const names = refusal.invalidParams.map((param) => param.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "file.survey.blocks.0.elements.0.headline",
        "file.survey.blocks.0.elements.0.required",
      ])
    );
    expect(names.every((name) => name.startsWith("file."))).toBe(true);
  });

  test("refuses a trigger whose action class the file does not carry, and targeting naming a key it does not carry", () => {
    const appSurvey = {
      ...survey(),
      type: "app",
      distribution: { triggers: [{ actionClassId: ACTION_CLASS_ID }] },
      targeting: {
        filters: [
          {
            id: "clfilter0000000000000001",
            connector: null,
            resource: {
              id: "clresource00000000000001",
              root: { type: "attribute", contactAttributeKey: "plan" },
              qualifier: { operator: "equals" },
              value: "pro",
            },
          },
        ],
      },
    };

    const refusal = refusalOf(() => readFormbricksFile(file({ survey: appSurvey })));

    expect(refusal.problemCode).toBe("formbricks_file_invalid");
    expect(refusal.invalidParams).toEqual([
      expect.objectContaining({
        name: "file.survey.distribution.triggers.0.actionClassId",
        code: "dangling_reference",
        identifier: ACTION_CLASS_ID,
      }),
      expect.objectContaining({
        name: "file.survey.targeting.filters",
        code: "dangling_reference",
        identifier: "plan",
      }),
    ]);
  });
});

describe("readFormbricksFile's limits", () => {
  const actionClass = (index: number) => ({
    id: `claction${String(index).padStart(16, "0")}`,
    name: `Action ${index}`,
    description: null,
    type: "code",
    key: `action-${index}`,
    noCodeConfig: null,
  });
  const attributeKey = (index: number) => ({
    key: `key_${index}`,
    name: `Key ${index}`,
    description: null,
    dataType: "string",
  });
  const embeddedField = (index: number) => ({
    storageKey: `field_${index}`,
    key: `field_${index}`,
    name: `Field ${index}`,
    source: "ingested",
    dataType: "string",
    defaultValue: null,
    locked: false,
  });
  const language = (index: number) => ({ code: `x-${index}`, alias: `Language ${index}` });

  test.each([
    ["actionClasses", FORMBRICKS_FILE_MAX_ACTION_CLASSES, actionClass],
    ["attributeKeys", FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS, attributeKey],
    ["embeddedFields", FORMBRICKS_FILE_MAX_EMBEDDED_FIELDS, embeddedField],
    ["languages", V3_SURVEY_MAX_LANGUAGES, language],
  ] as const)("reads %s up to %i, and refuses one more naming the list", (kind, max, build) => {
    const listOf = (count: number) => ({
      ...references(),
      [kind]: Array.from({ length: count }, (_, index) => build(index)),
    });

    expect(readFormbricksFile(file({ references: listOf(max) })).content.references[kind]).toHaveLength(max);

    const refusal = refusalOf(() => readFormbricksFile(file({ references: listOf(max + 1) })));
    expect(refusal.problemCode).toBe("formbricks_file_invalid");
    expect(refusal.invalidParams).toEqual([expect.objectContaining({ name: `file.references.${kind}` })]);
  });

  /** A survey whose JSON is exactly `bytes` long, padded in a text the survey keeps. */
  const surveyOfSize = (bytes: number) => {
    const padded = (padding: string) => ({ ...survey(), name: `Onboarding NPS${padding}` });
    return padded(" ".repeat(bytes - JSON.stringify(padded("")).length));
  };

  test("reads a survey of exactly the size one may weigh, and refuses a byte more with a 413 naming the survey", () => {
    const atLimit = surveyOfSize(FORMBRICKS_FILE_MAX_SURVEY_BYTES);
    expect(Buffer.byteLength(JSON.stringify(atLimit))).toBe(FORMBRICKS_FILE_MAX_SURVEY_BYTES);
    expect(readFormbricksFile(file({ survey: atLimit })).content.survey.name).toBe(atLimit.name);

    const overLimit = file({ survey: surveyOfSize(FORMBRICKS_FILE_MAX_SURVEY_BYTES + 1) });
    expect(() => readFormbricksFile(overLimit)).toThrow(SurveyImportFileTooLargeError);
    expect(() => readFormbricksFile(overLimit)).toThrow(
      expect.objectContaining({
        invalidParams: [
          expect.objectContaining({
            name: "file.survey",
            code: "file_limit_exceeded",
            identifier: "survey_size",
          }),
        ],
      })
    );
  });
});

describe("readFormbricksFileContent", () => {
  test("reads the survey and references the dialog sends back, naming problems from the body's root", () => {
    expect(readFormbricksFileContent({ survey: survey(), references: references() }).content.survey).toEqual(
      survey()
    );

    const refusal = refusalOf(() =>
      readFormbricksFileContent({ survey: { ...survey(), name: 42 }, references: references() })
    );
    expect(refusal.invalidParams).toEqual([expect.objectContaining({ name: "survey.name" })]);
  });
});

describe("upgradeFormbricksFile", () => {
  test("runs each step from the file's format up to the current one, in order", () => {
    const upgraded = upgradeFormbricksFile(
      { formbricks: { format: 1 }, trail: [] },
      {
        from: 1,
        to: 3,
        steps: {
          1: (old) => ({ ...old, trail: [...(old.trail as string[]), "1→2"] }),
          2: (old) => ({ ...old, trail: [...(old.trail as string[]), "2→3"] }),
        },
      }
    );

    expect(upgraded.trail).toEqual(["1→2", "2→3"]);
  });

  test("leaves a file of the current format as it is", () => {
    const current = file();
    expect(upgradeFormbricksFile(current, { from: 1 })).toBe(current);
  });

  test("throws when a format has no step to the next", () => {
    expect(() => upgradeFormbricksFile({}, { from: 1, to: 2, steps: {} })).toThrow(
      "No upgrade step from Formbricks file format 1"
    );
  });
});
