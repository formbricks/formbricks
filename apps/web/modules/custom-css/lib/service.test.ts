import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TCustomCssInput, TCustomCssStored } from "@formbricks/types/custom-css";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { processCustomCss } from "@/modules/custom-css/processor";
import { getCustomCssPlanAllowed } from "./access";
import {
  CustomCssInvalidError,
  CustomCssPlanRequiredError,
  classifyCustomCssChange,
  getWorkspaceCustomCssRecord,
  isSameStoredCustomCss,
  previewCustomCss,
  readCustomCssPayloadSource,
  resolveCopiedSurveyCustomCss,
  resolveCustomCssWrite,
  resolveCustomCssWriteOrThrow,
  updateWorkspaceCustomCss,
} from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    workspace: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/cache", () => ({ cache: { del: vi.fn() } }));

// The processor is W1's module; its contract is mocked here so this suite tests the save rules only.
vi.mock("@/modules/custom-css/processor", () => ({
  CUSTOM_CSS_PROCESSOR_VERSION: 7,
  processCustomCss: vi.fn(),
  normalizeCustomCssInput: (input: TCustomCssInput | null | undefined) => {
    if (!input) return null;
    const light = input.light?.trim() ? input.light : null;
    const dark = input.dark?.trim() ? input.dark : null;
    return light === null && dark === null ? null : { light, dark };
  },
}));

vi.mock("./access", () => ({
  CUSTOM_CSS_PLAN_REQUIRED_MESSAGE: "Adding or editing custom CSS requires the Scale plan.",
  getCustomCssPlanAllowed: vi.fn(),
}));

const stored = (light: string | null, dark: string | null, processorVersion = 7): TCustomCssStored => ({
  light: light === null ? null : { source: light, compiled: `@layer fb-survey{${light}}` },
  dark: dark === null ? null : { source: dark, compiled: `@layer fb-survey-dark{${dark}}` },
  processorVersion,
});

const processedOk = (input: TCustomCssInput) => ({
  ok: true as const,
  compiled: {
    light: input.light === null ? null : `COMPILED(${input.light})`,
    dark: input.dark === null ? null : `COMPILED_DARK(${input.dark})`,
  },
  warnings: [
    {
      code: "import_removed" as const,
      scope: "survey" as const,
      appearance: "light" as const,
      line: 1,
      column: 1,
      reason: "@import is not supported",
    },
  ],
  processorVersion: 7,
});

const syntaxError = {
  code: "syntax_error" as const,
  scope: "survey" as const,
  appearance: "light" as const,
  line: 2,
  column: 4,
  reason: "Unexpected token",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(true);
  vi.mocked(processCustomCss).mockImplementation((({ input }: { input: TCustomCssInput }) =>
    processedOk(input)) as never);
  vi.mocked(cache.del).mockResolvedValue({ ok: true, data: undefined });
});

describe("classifyCustomCssChange", () => {
  test("treats whitespace-only and null fields alike, comparing normalized source only", () => {
    expect(classifyCustomCssChange(null, { light: "  ", dark: null })).toBe("unchanged");
    expect(classifyCustomCssChange(stored("a{}", null), { light: "a{}", dark: "\n" })).toBe("unchanged");
  });

  test("clearing a field without adding anything is a removal", () => {
    expect(classifyCustomCssChange(stored("a{}", "b{}"), { light: null, dark: "b{}" })).toBe("removal");
    expect(classifyCustomCssChange(stored("a{}", "b{}"), null)).toBe("removal");
  });

  test("adding or editing either field is an edit", () => {
    expect(classifyCustomCssChange(null, { light: "a{}", dark: null })).toBe("edit");
    expect(classifyCustomCssChange(stored("a{}", null), { light: "a{ }", dark: null })).toBe("edit");
    expect(classifyCustomCssChange(stored("a{}", "b{}"), { light: null, dark: "c{}" })).toBe("edit");
  });
});

describe("resolveCustomCssWrite", () => {
  test("unchanged source needs no plan and no processing, even on a downgraded organization", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);
    const existing = stored("a{}", null);

    const outcome = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing,
      input: { light: "a{}", dark: null },
    });

    expect(outcome).toEqual({ ok: true, stored: existing, warnings: [], changed: false });
    expect(getCustomCssPlanAllowed).not.toHaveBeenCalled();
    expect(processCustomCss).not.toHaveBeenCalled();
  });

  test("does not even resolve the organization when nothing changed", async () => {
    const organizationId = vi.fn(async () => "org_1");

    await resolveCustomCssWrite({ scope: "survey", organizationId, existing: null, input: null });

    expect(organizationId).not.toHaveBeenCalled();
  });

  test("removal is allowed without the plan and keeps the remaining field's output and version", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    const clearLight = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing: stored("a{}", "b{}", 3),
      input: { light: null, dark: "b{}" },
    });
    expect(clearLight).toEqual({
      ok: true,
      stored: { light: null, dark: stored("a{}", "b{}", 3).dark, processorVersion: 3 },
      warnings: [],
      changed: true,
    });

    const clearAll = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing: stored("a{}", "b{}"),
      input: null,
    });
    expect(clearAll).toEqual({ ok: true, stored: null, warnings: [], changed: true });

    expect(getCustomCssPlanAllowed).not.toHaveBeenCalled();
    expect(processCustomCss).not.toHaveBeenCalled();
  });

  test("an addition without the plan is refused before any processing", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    const outcome = await resolveCustomCssWrite({
      scope: "workspace",
      organizationId: "org_1",
      existing: null,
      input: { light: "a{}", dark: null },
    });

    expect(outcome).toEqual({ ok: false, code: "plan_required" });
    expect(getCustomCssPlanAllowed).toHaveBeenCalledWith("org_1");
    expect(processCustomCss).not.toHaveBeenCalled();
  });

  test("a downgraded organization cannot edit, even while clearing the other field", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    const outcome = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing: stored("a{}", "b{}"),
      input: { light: "a{color:red}", dark: null },
    });

    expect(outcome).toEqual({ ok: false, code: "plan_required" });
  });

  test("an edit stores the processor's output and version with the typed source", async () => {
    const outcome = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: async () => "org_lazy",
      existing: stored("a{}", null, 1),
      input: { light: "  a{color:red}  ", dark: "" },
    });

    expect(getCustomCssPlanAllowed).toHaveBeenCalledWith("org_lazy");
    expect(processCustomCss).toHaveBeenCalledWith({
      scope: "survey",
      input: { light: "  a{color:red}  ", dark: null },
    });
    expect(outcome).toEqual({
      ok: true,
      stored: {
        light: { source: "  a{color:red}  ", compiled: "COMPILED(  a{color:red}  )" },
        dark: null,
        processorVersion: 7,
      },
      warnings: processedOk({ light: "", dark: null }).warnings,
      changed: true,
    });
  });

  test("invalid CSS returns the processor's errors and nothing to store", async () => {
    vi.mocked(processCustomCss).mockResolvedValue({ ok: false, errors: [syntaxError] });

    const outcome = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing: stored("a{}", null),
      input: { light: "a{", dark: null },
    });

    expect(outcome).toEqual({ ok: false, code: "invalid_css", errors: [syntaxError] });
  });

  test("a processor that throws is a processing failure, not a 500", async () => {
    vi.mocked(processCustomCss).mockRejectedValue(new Error("boom"));

    const outcome = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing: null,
      input: { light: "a{}", dark: null },
    });

    expect(outcome).toMatchObject({
      ok: false,
      code: "invalid_css",
      errors: [{ code: "processing_failed" }],
    });
  });
});

describe("resolveCustomCssWriteOrThrow", () => {
  test("throws typed errors that internal callers surface as 403 / 400", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValueOnce(false);
    const args = {
      scope: "survey" as const,
      organizationId: "org_1",
      existing: null,
      input: { light: "a{}", dark: null },
    };

    const planError = await resolveCustomCssWriteOrThrow(args).catch((error: unknown) => error);
    expect(planError).toBeInstanceOf(CustomCssPlanRequiredError);
    expect(planError).toBeInstanceOf(OperationNotAllowedError);

    vi.mocked(processCustomCss).mockResolvedValueOnce({ ok: false, errors: [syntaxError] });
    const cssError = await resolveCustomCssWriteOrThrow(args).catch((error: unknown) => error);
    expect(cssError).toBeInstanceOf(CustomCssInvalidError);
    expect(cssError).toBeInstanceOf(InvalidInputError);
    expect((cssError as CustomCssInvalidError).errors).toEqual([syntaxError]);
    expect((cssError as Error).message).toContain("light CSS, line 2:4");
  });
});

describe("readCustomCssPayloadSource", () => {
  test("an absent key means unchanged and null means clear", () => {
    expect(readCustomCssPayloadSource(undefined)).toBeUndefined();
    expect(readCustomCssPayloadSource(null)).toBeNull();
  });

  test("reads only source and ignores caller-supplied compiled output and version", () => {
    expect(
      readCustomCssPayloadSource({
        light: { source: "a{}", compiled: "#fbjs{position:fixed}" },
        dark: null,
        processorVersion: 999,
      })
    ).toEqual({ light: "a{}", dark: null });
  });

  test("refuses a malformed or oversized value", () => {
    expect(() => readCustomCssPayloadSource({ light: "a{}", dark: null })).toThrow(InvalidInputError);
    expect(() => readCustomCssPayloadSource({ light: { source: "a".repeat(100_001) }, dark: null })).toThrow(
      InvalidInputError
    );
  });
});

describe("previewCustomCss", () => {
  test("processes without a plan check, and empty input compiles to nothing", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    await expect(previewCustomCss("workspace", { light: " ", dark: null })).resolves.toEqual({
      ok: true,
      compiled: { light: null, dark: null },
      warnings: [],
    });
    await expect(previewCustomCss("workspace", { light: "a{}", dark: null })).resolves.toMatchObject({
      ok: true,
      compiled: { light: "COMPILED(a{})", dark: null },
    });
    expect(getCustomCssPlanAllowed).not.toHaveBeenCalled();
  });
});

describe("updateWorkspaceCustomCss", () => {
  const tx = {
    $queryRaw: vi.fn(),
    workspace: { update: vi.fn() },
  };
  /** What the save reads before processing, and what it finds once the row is locked. */
  const givenStored = (value: TCustomCssStored | null, ...lockedReads: (TCustomCssStored | null)[]) => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ customCss: value } as never);
    const reads = lockedReads.length > 0 ? lockedReads : [value];
    tx.$queryRaw.mockReset();
    for (const read of reads) tx.$queryRaw.mockResolvedValueOnce([{ customCss: read }]);
    tx.$queryRaw.mockResolvedValue([{ customCss: reads[reads.length - 1] }]);
  };

  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (client: typeof tx) => unknown) =>
      fn(tx)) as never);
  });

  test("an edit moves the replaced value into customCssPrevious atomically and invalidates the workspace state", async () => {
    const existing = stored("old{}", null, 7);
    givenStored(existing);

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "new{}", dark: null },
    });

    expect(outcome).toMatchObject({ ok: true, changed: true });
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "ws_1", organizationId: "org_1" },
      select: { customCss: true },
    });
    expect(tx.workspace.update).toHaveBeenCalledWith({
      where: { id: "ws_1", organizationId: "org_1" },
      data: {
        customCss: {
          light: { source: "new{}", compiled: "COMPILED(new{})" },
          dark: null,
          processorVersion: 7,
        },
        customCssPrevious: existing,
      },
      select: { id: true },
    });
    expect(cache.del).toHaveBeenCalledWith(["fb:env:ws_1:state"]);
  });

  test("processes the CSS before taking the row lock", async () => {
    givenStored(stored("old{}", null));
    const order: string[] = [];
    vi.mocked(processCustomCss).mockImplementation((({ input }: { input: TCustomCssInput }) => {
      order.push("process");
      return processedOk(input);
    }) as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (client: typeof tx) => unknown) => {
      order.push("lock");
      return fn(tx);
    }) as never);

    await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "new{}", dark: null },
    });

    expect(order).toEqual(["process", "lock"]);
  });

  test("a concurrent change is re-resolved against the newer value, and that value becomes previous", async () => {
    const concurrent = stored("theirs{}", null);
    givenStored(stored("old{}", null), concurrent, concurrent);

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "new{}", dark: null },
    });

    expect(outcome).toMatchObject({ ok: true, changed: true });
    expect(processCustomCss).toHaveBeenCalledTimes(2);
    expect(tx.workspace.update).toHaveBeenCalledTimes(1);
    expect(tx.workspace.update.mock.calls[0][0].data.customCssPrevious).toEqual(concurrent);
  });

  test("a removal that a concurrent clear turned into an addition needs the plan again", async () => {
    givenStored(stored("a{}", "d{}"), null, null);
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "a{}", dark: null },
    });

    expect(outcome).toEqual({ ok: false, code: "plan_required" });
    expect(tx.workspace.update).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
  });

  test("a change in compiled version alone also counts as a concurrent change", async () => {
    givenStored(stored("old{}", null, 6), stored("old{}", null, 7), stored("old{}", null, 7));

    await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "new{}", dark: null },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.workspace.update.mock.calls[0][0].data.customCssPrevious).toEqual(stored("old{}", null, 7));
  });

  test("after one retry, a third contender is settled under the lock", async () => {
    const latest = stored("latest{}", null);
    givenStored(stored("old{}", null), stored("second{}", null), latest, latest);

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "new{}", dark: null },
    });

    expect(outcome).toMatchObject({ ok: true, changed: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(processCustomCss).toHaveBeenCalledTimes(3);
    expect(tx.workspace.update).toHaveBeenCalledTimes(1);
    expect(tx.workspace.update.mock.calls[0][0].data.customCssPrevious).toEqual(latest);
  });

  test("the first save keeps an older recoverable revision rather than overwriting it with nothing", async () => {
    givenStored(null);

    await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "new{}", dark: null },
    });

    expect(tx.workspace.update.mock.calls[0][0].data).not.toHaveProperty("customCssPrevious");
  });

  test("clearing stores null and keeps what was cleared recoverable", async () => {
    const existing = stored("old{}", "dark{}");
    givenStored(existing);
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: null,
    });

    expect(outcome).toEqual({ ok: true, stored: null, warnings: [], changed: true });
    const data = tx.workspace.update.mock.calls[0][0].data;
    expect(data.customCssPrevious).toEqual(existing);
    expect(String(data.customCss)).toContain("DbNull");
  });

  test("restoring the previous revision is a normal save of its source", async () => {
    const current = stored("current{}", null);
    givenStored(current);

    await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "restored{}", dark: null },
    });

    expect(getCustomCssPlanAllowed).toHaveBeenCalledWith("org_1");
    expect(processCustomCss).toHaveBeenCalledWith({
      scope: "workspace",
      input: { light: "restored{}", dark: null },
    });
    expect(tx.workspace.update.mock.calls[0][0].data.customCssPrevious).toEqual(current);
  });

  test("malformed CSS writes nothing and takes no lock, so the saved revision stays live", async () => {
    givenStored(stored("good{}", null));
    vi.mocked(processCustomCss).mockResolvedValue({ ok: false, errors: [syntaxError] });

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "bad{", dark: null },
    });

    expect(outcome).toEqual({ ok: false, code: "invalid_css", errors: [syntaxError] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.workspace.update).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
  });

  test("an unchanged save writes nothing and invalidates nothing", async () => {
    givenStored(stored("same{}", null));

    const outcome = await updateWorkspaceCustomCss({
      workspaceId: "ws_1",
      organizationId: "org_1",
      input: { light: "same{}", dark: "" },
    });

    expect(outcome).toMatchObject({ ok: true, changed: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.workspace.update).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
  });

  test("an unknown workspace, or one in another organization, is a ResourceNotFoundError", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(
      updateWorkspaceCustomCss({ workspaceId: "ws_x", organizationId: "org_1", input: null })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a workspace that disappears before the lock is a ResourceNotFoundError", async () => {
    givenStored(stored("old{}", null));
    tx.$queryRaw.mockReset();
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      updateWorkspaceCustomCss({ workspaceId: "ws_1", organizationId: "org_1", input: null })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(tx.workspace.update).not.toHaveBeenCalled();
  });
});

describe("isSameStoredCustomCss", () => {
  test("compares normalized source and processor version, never compiled output", () => {
    const a = stored("a{}", null, 7);
    expect(isSameStoredCustomCss(a, { ...a, light: { source: "a{}", compiled: "other" } })).toBe(true);
    expect(isSameStoredCustomCss(a, stored("a{}", " ", 7))).toBe(true);
    expect(isSameStoredCustomCss(a, stored("a{}", null, 8))).toBe(false);
    expect(isSameStoredCustomCss(a, stored("b{}", null, 7))).toBe(false);
    expect(isSameStoredCustomCss(null, null)).toBe(true);
    expect(isSameStoredCustomCss(a, null)).toBe(false);
  });
});

describe("getWorkspaceCustomCssRecord", () => {
  test("returns current and previous, treating a corrupt stored value as absent", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      customCss: stored("a{}", null),
      customCssPrevious: { light: "not the stored shape" },
    } as never);

    await expect(getWorkspaceCustomCssRecord("ws_1")).resolves.toEqual({
      customCss: stored("a{}", null),
      previous: null,
    });
  });

  test("throws for an unknown workspace", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);
    await expect(getWorkspaceCustomCssRecord("ws_x")).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("resolveCopiedSurveyCustomCss", () => {
  test("a survey without CSS copies without CSS", async () => {
    await expect(
      resolveCopiedSurveyCustomCss({ source: null, destinationOrganizationId: "org_1" })
    ).resolves.toEqual({ customCss: null });
    expect(processCustomCss).not.toHaveBeenCalled();
  });

  test("reprocesses the source for the destination rather than copying compiled output", async () => {
    const result = await resolveCopiedSurveyCustomCss({
      source: stored("a{}", null, 1),
      destinationOrganizationId: "org_dest",
    });

    expect(getCustomCssPlanAllowed).toHaveBeenCalledWith("org_dest");
    expect(result).toEqual({
      customCss: { light: { source: "a{}", compiled: "COMPILED(a{})" }, dark: null, processorVersion: 7 },
    });
  });

  test("a destination without the plan gets no CSS and a notice", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    await expect(
      resolveCopiedSurveyCustomCss({ source: stored("a{}", null), destinationOrganizationId: "org_dest" })
    ).resolves.toEqual({ customCss: null, notice: "plan_required" });
  });

  test("source that no longer passes the processor is dropped with a notice", async () => {
    vi.mocked(processCustomCss).mockResolvedValue({ ok: false, errors: [syntaxError] });

    await expect(
      resolveCopiedSurveyCustomCss({ source: stored("a{", null), destinationOrganizationId: "org_dest" })
    ).resolves.toEqual({ customCss: null, notice: "invalid_css" });
  });
});
