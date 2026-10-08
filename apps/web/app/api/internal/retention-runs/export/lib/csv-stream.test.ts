import { describe, expect, test, vi } from "vitest";
import type { TRetentionExportRow } from "@/modules/ee/data-retention/lib/runs-service";
import { createRetentionExportStream } from "./csv-stream";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const run = {
  id: "run_1",
  entity: "members" as const,
  startedAt: new Date("2030-01-01T02:00:00Z"),
  finishedAt: new Date("2030-01-01T02:05:00Z"),
  notifiedCount: 1,
  archivedCount: 1,
  deletedCount: 0,
  skippedCount: 0,
  hasChanges: true,
};
const item = (overrides: Partial<NonNullable<TRetentionExportRow["item"]>> = {}) => ({
  id: "item_1",
  runId: run.id,
  targetType: "user" as const,
  targetId: "user_1",
  targetName: "Ada",
  action: "notified" as const,
  count: 1,
  recipient: "ada@example.test",
  skipReason: null,
  ...overrides,
});

async function* rowsOf(rows: TRetentionExportRow[], failAfter?: number) {
  let index = 0;
  for (const row of rows) {
    if (failAfter !== undefined && index === failAfter) throw new Error("database went away");
    index++;
    yield row;
  }
}

const readAll = async (stream: ReadableStream<Uint8Array>) => new Response(stream).text();

describe("createRetentionExportStream", () => {
  test("writes the header, then one line per item and one for a run without items", async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    const emptyRun = { ...run, id: "run_2", hasChanges: false };

    const csv = await readAll(
      createRetentionExportStream({
        rows: rowsOf([
          { run, item: item() },
          { run, item: item({ id: "item_2", action: "deactivated", recipient: null }) },
          { run: emptyRun, item: null },
        ]),
        signal: new AbortController().signal,
        onFinish,
      })
    );

    expect(csv.split("\r\n")).toEqual([
      '"run_id","policy","run_started_at","run_finished_at","action","target_type","target_id","target_name","count","recipient","skip_reason"',
      '"run_1","members","2030-01-01T02:00:00.000Z","2030-01-01T02:05:00.000Z","notified","user","user_1","Ada",1,"ada@example.test",',
      '"run_1","members","2030-01-01T02:00:00.000Z","2030-01-01T02:05:00.000Z","deactivated","user","user_1","Ada",1,,',
      '"run_2","members","2030-01-01T02:00:00.000Z","2030-01-01T02:05:00.000Z",,,,,,,',
      "",
    ]);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ status: "success", rows: 3 });
  });

  test("defangs a name that a spreadsheet would run as a formula", async () => {
    const csv = await readAll(
      createRetentionExportStream({
        rows: rowsOf([{ run, item: item({ targetName: '=HYPERLINK("http://evil")' }) }]),
        signal: new AbortController().signal,
        onFinish: vi.fn().mockResolvedValue(undefined),
      })
    );

    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  test("fails the download and records a failure when reading stops partway", async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);

    await expect(
      readAll(
        createRetentionExportStream({
          rows: rowsOf(
            [
              { run, item: item() },
              { run, item: item() },
            ],
            1
          ),
          signal: new AbortController().signal,
          onFinish,
        })
      )
    ).rejects.toThrow("database went away");
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ status: "failure", rows: 1, reason: "error" });
  });

  test("records an aborted export when the client goes away", async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    const stream = createRetentionExportStream({
      rows: rowsOf([{ run, item: item() }]),
      signal: new AbortController().signal,
      onFinish,
    });

    const reader = stream.getReader();
    await reader.read(); // the header
    await reader.cancel();

    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ status: "failure", rows: 0, reason: "aborted" });
  });

  test("stops reading once the request is aborted", async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    const rows = rowsOf([{ run, item: item() }]);
    const next = vi.spyOn(rows, "next");
    const stream = createRetentionExportStream({ rows, signal: controller.signal, onFinish });

    // Aborted before the body is read: the stream pulls ahead to refill its queue, so an abort that
    // lands after the first read can race the next batch.
    controller.abort();

    expect(await readAll(stream)).toBe(
      '"run_id","policy","run_started_at","run_finished_at","action","target_type","target_id","target_name","count","recipient","skip_reason"\r\n'
    );
    expect(next).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ status: "failure", rows: 0, reason: "aborted" });
  });
});
