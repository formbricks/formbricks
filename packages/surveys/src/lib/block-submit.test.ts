import { describe, expect, test, vi } from "vitest";
import {
  type BlockSubmitRunnerOptions,
  PENDING_ANSWER,
  type SubmitContributor,
  type SubmitContributors,
  answersForValidation,
  createBlockSubmitRunner,
  resolveContributedAnswers,
} from "./block-submit";

const contributor = (overrides: Partial<SubmitContributor> = {}): SubmitContributor => ({
  hasAnswer: () => false,
  resolveAnswer: () => Promise.resolve({ ok: true, data: {} }),
  ...overrides,
});
const contributors = (entries: Record<string, SubmitContributor>): SubmitContributors =>
  new Map(Object.entries(entries));
const STORED = "/storage/ws1/private/surveys/s1/elements/sig/a.png";

describe("answersForValidation", () => {
  test("a pending answer counts as given, so a required Signature is not reported empty", () => {
    const result = answersForValidation(
      { other: "x" },
      contributors({ sig: contributor({ hasAnswer: () => true }) })
    );
    expect(result).toEqual({ other: "x", sig: PENDING_ANSWER });
  });

  test("an element with no answer stays empty", () => {
    expect(answersForValidation({}, contributors({ sig: contributor() }))).toEqual({});
  });

  test("a stored answer the element still holds is left as it is", () => {
    const stored = { sig: STORED };
    expect(answersForValidation(stored, contributors({ sig: contributor({ hasAnswer: () => true }) }))).toBe(
      stored
    );
  });

  test("an empty-string answer with something pending is pending", () => {
    expect(
      answersForValidation({ sig: "" }, contributors({ sig: contributor({ hasAnswer: () => true }) }))
    ).toEqual({ sig: PENDING_ANSWER });
  });

  test("a stale stored answer the element has just cleared counts as empty, not as answered", () => {
    expect(answersForValidation({ sig: STORED, other: "x" }, contributors({ sig: contributor() }))).toEqual({
      other: "x",
    });
  });
});

describe("resolveContributedAnswers", () => {
  test("merges the answers every contributor produced", async () => {
    const result = await resolveContributedAnswers(
      contributors({
        a: contributor({ resolveAnswer: () => Promise.resolve({ ok: true, data: { a: "/storage/a.png" } }) }),
        b: contributor({ resolveAnswer: () => Promise.resolve({ ok: true, data: {} }) }),
        c: contributor({ resolveAnswer: () => Promise.resolve({ ok: true, data: { c: "/storage/c.png" } }) }),
      })
    );
    expect(result).toEqual({ ok: true, data: { a: "/storage/a.png", c: "/storage/c.png" } });
  });

  test("stops at the first failure and names the element, so the block does not advance", async () => {
    const afterFailure = vi.fn(() => Promise.resolve({ ok: true as const, data: {} }));
    const result = await resolveContributedAnswers(
      contributors({
        a: contributor({ resolveAnswer: () => Promise.resolve({ ok: false }) }),
        b: contributor({ resolveAnswer: afterFailure }),
      })
    );
    expect(result).toEqual({ ok: false, failedElementId: "a" });
    expect(afterFailure).not.toHaveBeenCalled();
  });

  test("with no contributors there is nothing to wait for", async () => {
    expect(await resolveContributedAnswers(new Map())).toEqual({ ok: true, data: {} });
  });

  test("a contributor re-registering while an earlier one is awaited does not make the loop run forever", async () => {
    const map = new Map<string, SubmitContributor>();
    const registered = contributor({
      resolveAnswer: async () => {
        // What a re-rendering element does mid-upload: unregister, then register a new contributor.
        map.delete("a");
        map.set("a", contributor());
        return { ok: true as const, data: {} };
      },
    });
    map.set("a", registered);
    expect(await resolveContributedAnswers(map)).toEqual({ ok: true, data: {} });
  });
});

describe("createBlockSubmitRunner", () => {
  const setup = (overrides: Partial<BlockSubmitRunnerOptions> = {}) => {
    const events: string[] = [];
    let mounted = true;
    const options: BlockSubmitRunnerOptions = {
      getContributors: () =>
        contributors({
          sig: contributor({
            resolveAnswer: () => Promise.resolve({ ok: true, data: { sig: STORED } }),
          }),
        }),
      collectResponses: () => ({ other: "x", sig: "/storage/stale.png" }),
      onSubmit: vi.fn((answers) => events.push(`submit ${JSON.stringify(answers)}`)),
      onFailure: vi.fn((id) => events.push(`failure ${id}`)),
      onBusyChange: vi.fn((busy) => events.push(`busy ${String(busy)}`)),
      isMounted: () => mounted,
      onError: vi.fn(),
      ...overrides,
    };
    return { options, events, unmount: () => (mounted = false), runner: createBlockSubmitRunner(options) };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  test("submits once with the contributors' answers replacing whatever the block held for them", async () => {
    const { runner, options, events } = setup();
    expect(runner.run()).toBe(true);
    await settle();
    expect(options.onSubmit).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      "busy true",
      `submit ${JSON.stringify({ other: "x", sig: STORED })}`,
      "busy false",
    ]);
  });

  test("two synchronous presses dispatch one upload and one submit", async () => {
    const resolveAnswer = vi.fn(() => Promise.resolve({ ok: true as const, data: { sig: STORED } }));
    const { runner, options } = setup({
      getContributors: () => contributors({ sig: contributor({ resolveAnswer }) }),
    });
    const first = runner.run();
    const second = runner.run();
    await settle();
    expect([first, second]).toEqual([true, false]);
    expect(resolveAnswer).toHaveBeenCalledTimes(1);
    expect(options.onSubmit).toHaveBeenCalledTimes(1);
  });

  test("a contributor failure reports it, does not advance, and the next press runs again", async () => {
    let fail = true;
    const { runner, options } = setup({
      getContributors: () =>
        contributors({
          sig: contributor({
            resolveAnswer: () =>
              Promise.resolve(fail ? { ok: false as const } : { ok: true as const, data: { sig: STORED } }),
          }),
        }),
    });
    runner.run();
    await settle();
    expect(options.onFailure).toHaveBeenCalledWith("sig");
    expect(options.onSubmit).not.toHaveBeenCalled();
    expect(options.onBusyChange).toHaveBeenLastCalledWith(false);

    fail = false;
    expect(runner.run()).toBe(true);
    await settle();
    expect(options.onSubmit).toHaveBeenCalledTimes(1);
  });

  test("when the card is gone by the time the upload finishes, nothing advances and nothing is touched", async () => {
    const { runner, options, unmount } = setup();
    runner.run();
    unmount();
    await settle();
    expect(options.onSubmit).not.toHaveBeenCalled();
    expect(options.onFailure).not.toHaveBeenCalled();
    expect(options.onBusyChange).toHaveBeenCalledTimes(1); // the initial `true`, no state set on a gone block
  });

  test("a throwing onSubmit is reported, not left as an unhandled rejection, and releases the guard", async () => {
    const boom = new Error("submit failed");
    const onSubmit = vi.fn().mockImplementationOnce(() => {
      throw boom;
    });
    const { runner, options } = setup({ onSubmit });
    runner.run();
    await settle();
    expect(options.onError).toHaveBeenCalledWith(boom);
    expect(options.onBusyChange).toHaveBeenLastCalledWith(false);

    expect(runner.run()).toBe(true);
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
