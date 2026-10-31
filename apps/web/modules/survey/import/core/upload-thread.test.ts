import { MessageChannel } from "node:worker_threads";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_FILE_V1_SCHEMA_URL } from "@/modules/survey/formbricks-file/envelope";
import { loadDocumentFixture } from "../document/__fixtures__/load-fixture";
import { SURVEY_IMPORT_ZIP_MAX_ENTRIES } from "../limits";
import { loadQsfFixture } from "../qsf/__fixtures__/load-fixture";
import { openSurveyImportUploadInProcess } from "./__fixtures__/in-process-upload";
import { bundleUploadWorker } from "./__fixtures__/upload-worker-bundle";
import { zipOf } from "./__fixtures__/zip-builders";
import { toSurveyImportRefusal } from "./errors";
import { serveSurveyImportUpload } from "./upload-worker";

const limits = vi.hoisted(() => ({ readTimeMs: 30_000 }));

vi.mock("server-only", () => ({}));
vi.mock("../limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../limits")>()),
  get SURVEY_IMPORT_READ_TIME_MS() {
    return limits.readTimeMs;
  },
}));

const { openSurveyImportUpload, readSurveyImportUploadAs } = await import("./upload-thread");

const encode = (text: string) => new TextEncoder().encode(text);

const formbricksFile = (format = 1) => ({
  $schema: FORMBRICKS_FILE_V1_SCHEMA_URL,
  formbricks: {
    format,
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
    type: "link",
    defaultLanguage: "en-US",
    languages: [{ code: "en-US", default: true, enabled: true }],
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

/** A 15 MiB JSON upload of a million small objects: the most a thread spends telling a file apart. */
const millionObjects = () => {
  const entries: string[] = [];
  let length = 0;
  for (let index = 0; length < 15 * 1024 * 1024 - 100; index++) {
    const entry = `"k${index}":{}`;
    entries.push(entry);
    length += entry.length + 1;
  }
  return encode(`{"SurveyEntry":{},"SurveyElements":[],"x":{${entries.join(",")}}}`);
};

/** The longest the event loop went without a turn while `run` ran. */
const longestStall = async (run: () => Promise<unknown>): Promise<number> => {
  let longest = 0;
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
  }, 1);
  try {
    await run().catch(() => undefined);
  } finally {
    clearInterval(timer);
  }
  return Math.max(longest, performance.now() - last);
};

/** What `run` threw, as the refusal it would be posted as, or `null` for an error that is none. */
const refusalOf = async (run: () => Promise<unknown>) => {
  const error = await run().then(
    () => expect.unreachable("it should have been refused"),
    (thrown: unknown) => thrown
  );
  return toSurveyImportRefusal(error);
};

let workerUrl: URL;

beforeAll(async () => {
  workerUrl = await bundleUploadWorker();
}, 120_000);

const open = (bytes: Uint8Array) => openSurveyImportUpload(bytes, { workerUrl });

describe("openSurveyImportUpload: a file read in a thread of its own", () => {
  test.each([
    ["formbricks", () => encode(JSON.stringify(formbricksFile())), "survey.formbricks.json"],
    ["qsf", () => encode(JSON.stringify(loadQsfFixture("simple.qsf"))), "simple.qsf"],
    ["csv", () => loadDocumentFixture("sample-survey-2.csv"), "sample-survey-2.csv"],
    ["xlsx", () => loadDocumentFixture("sample-survey-2.xlsx"), "sample-survey-2.xlsx"],
    ["docx", () => loadDocumentFixture("sample-survey-2-word.docx"), "sample-survey-2-word.docx"],
  ] as const)("tells a %s file apart and reads it as this thread would", async (type, bytes, fileName) => {
    const upload = await open(bytes());
    expect(upload.type).toBe(type);

    const expected = await (await openSurveyImportUploadInProcess(bytes())).read(fileName);
    expect(await readSurveyImportUploadAs(upload, type, fileName)).toEqual(expected);
  });

  test.each([
    ["an empty file", () => new Uint8Array()],
    ["a PDF", () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0x00])],
    [
      "an archive past the entry limit",
      () =>
        zipOf(
          Object.fromEntries(
            Array.from({ length: SURVEY_IMPORT_ZIP_MAX_ENTRIES + 1 }, (_, index) => [`word/${index}.xml`, ""])
          )
        ),
    ],
    ["JSON that does not parse", () => encode('{"SurveyEntry": ')],
  ])("refuses %s while telling it apart, as this thread would", async (_label, bytes) => {
    const refusal = await refusalOf(() => open(bytes()));

    expect(refusal).not.toBeNull();
    expect(refusal).toEqual(await refusalOf(() => openSurveyImportUploadInProcess(bytes())));
  });

  test("refuses a file its lane cannot read when it reads it, with the lane's problem code", async () => {
    const bytes = () => encode(JSON.stringify(formbricksFile(2)));
    const upload = await open(bytes());

    const refusal = await refusalOf(() => upload.read("newer.formbricks.json"));

    expect(refusal).toMatchObject({ kind: "input", problemCode: "formbricks_file_too_new" });
    const inProcess = await openSurveyImportUploadInProcess(bytes());
    expect(refusal).toEqual(await refusalOf(() => inProcess.read("newer.formbricks.json")));
  });

  test("keeps this thread free while it reads the costliest JSON upload", async () => {
    const bytes = millionObjects();
    // The same file read on this thread holds it for hundreds of milliseconds (see the second check).
    const inThread = await longestStall(async () =>
      (await openSurveyImportUploadInProcess(millionObjects())).read("big.qsf")
    );

    const stall = await longestStall(async () => (await open(bytes)).read("big.qsf"));

    expect(inThread).toBeGreaterThan(200);
    expect(stall).toBeLessThan(100);
  }, 60_000);

  test("refuses a file its thread takes too long to read, and ends the thread", async () => {
    limits.readTimeMs = 20;
    try {
      const refusal = await refusalOf(() => open(millionObjects()));

      expect(refusal).toEqual({
        kind: "input",
        message: "The file is past one of the import's limits.",
        invalidParams: [
          expect.objectContaining({ name: "file", code: "file_limit_exceeded", identifier: "read_time" }),
        ],
      });
    } finally {
      limits.readTimeMs = 30_000;
    }
  }, 60_000);

  test("reads once, and ends the thread with the read", async () => {
    const upload = await open(encode(JSON.stringify(loadQsfFixture("simple.qsf"))));

    const first = upload.read("simple.qsf");
    expect(upload.read("again.qsf")).toBe(first);
    await first;

    await expect(upload.read("after.qsf")).rejects.toThrow("The survey import's reader was closed");
  });

  test("ends the thread when closed before the read, and answers a read after it with an error", async () => {
    const upload = await open(encode(JSON.stringify(loadQsfFixture("simple.qsf"))));

    upload.close();
    upload.close();

    const error = await upload.read("simple.qsf").catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(Error);
    expect(toSurveyImportRefusal(error)).toBeNull();
  });

  test("runs one thread at a time, and starts the next once the last has closed", async () => {
    const simple = () => encode(JSON.stringify(loadQsfFixture("simple.qsf")));
    const first = await open(simple());

    let secondOpened = false;
    const second = open(simple()).then((upload) => {
      secondOpened = true;
      return upload;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(secondOpened).toBe(false);

    first.close();
    const next = await second;
    expect(next.type).toBe("qsf");
    next.close();
  });

  test("passes the turn on when a thread fails", async () => {
    const exits = new URL("data:text/javascript,process.exit(3)");
    await openSurveyImportUpload(encode("{}"), { workerUrl: exits }).catch(() => undefined);

    const upload = await open(encode(JSON.stringify(loadQsfFixture("simple.qsf"))));
    expect(upload.type).toBe("qsf");
    upload.close();
  });

  test("answers a thread that ends without answering with an error, never a refusal", async () => {
    const exits = new URL("data:text/javascript,process.exit(3)");

    const error = await openSurveyImportUpload(encode("{}"), { workerUrl: exits }).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("The survey import's reader exited with 3");
    expect(toSurveyImportRefusal(error)).toBeNull();
  });
});

describe("serveSurveyImportUpload: the worker's side", () => {
  test("answers a read it was not asked to sniff for with a failure that names no file content", async () => {
    const { port1, port2 } = new MessageChannel();
    serveSurveyImportUpload(port2);

    const reply = new Promise((resolve) => port1.once("message", resolve));
    port1.postMessage({ step: "read", fileName: "never-sniffed.qsf" });

    expect(await reply).toMatchObject({
      ok: false,
      failure: { name: "Error", message: "The upload's worker was asked to read before it sniffed" },
    });
    port1.close();
  });
});
