import { describe, expect, test, vi } from "vitest";
import {
  type BlockSubmitRunnerOptions,
  type ContributedAnswer,
  PENDING_ANSWER,
  type SubmitContributor,
  type SubmitContributors,
  answersForValidation,
  createBlockSubmitRunner,
  resolveContributedAnswers,
} from "./block-submit";

type Resolve = () => Promise<ContributedAnswer>;

/** A contributor whose answer does not depend on when it is captured. */
const contributor = (
  overrides: { hasAnswer?: () => boolean; resolveAnswer?: Resolve } = {}
): SubmitContributor => ({
  hasAnswer: overrides.hasAnswer ?? (() => false),
  capture: () => overrides.resolveAnswer ?? (() => Promise.resolve({ ok: true, data: {} })),
});
const captured = (entries: Record<string, Resolve>) => new Map(Object.entries(entries));
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
      captured({
        a: () => Promise.resolve({ ok: true, data: { a: "/storage/a.png" } }),
        b: () => Promise.resolve({ ok: true, data: {} }),
        c: () => Promise.resolve({ ok: true, data: { c: "/storage/c.png" } }),
      })
    );
    expect(result).toEqual({ ok: true, data: { a: "/storage/a.png", c: "/storage/c.png" } });
  });

  test("stops at the first failure and names the element, so the block does not advance", async () => {
    const afterFailure = vi.fn(() => Promise.resolve({ ok: true as const, data: {} }));
    const result = await resolveContributedAnswers(
      captured({ a: () => Promise.resolve({ ok: false }), b: afterFailure })
    );
    expect(result).toEqual({ ok: false, failedElementId: "a" });
    expect(afterFailure).not.toHaveBeenCalled();
  });

  test("with no contributors there is nothing to wait for", async () => {
    expect(await resolveContributedAnswers(new Map())).toEqual({ ok: true, data: {} });
  });
});

describe("createBlockSubmitRunner", () => {
  const VALIDATED = { other: "x", sig: "pending" };

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
  const deferred = <T>() => {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>((res) => (resolve = res));
    return { promise, resolve };
  };

  test("submits once with the contributors' answers replacing whatever the snapshot held for them", async () => {
    const { runner, options, events } = setup();
    expect(runner.run(VALIDATED)).toBe(true);
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
    const first = runner.run(VALIDATED);
    const second = runner.run(VALIDATED);
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
    runner.run(VALIDATED);
    await settle();
    expect(options.onFailure).toHaveBeenCalledWith("sig");
    expect(options.onSubmit).not.toHaveBeenCalled();
    expect(options.onBusyChange).toHaveBeenLastCalledWith(false);

    fail = false;
    expect(runner.run(VALIDATED)).toBe(true);
    await settle();
    expect(options.onSubmit).toHaveBeenCalledTimes(1);
  });

  test("when the card is gone by the time the upload finishes, nothing advances and nothing is touched", async () => {
    const { runner, options, unmount } = setup();
    runner.run(VALIDATED);
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
    runner.run(VALIDATED);
    await settle();
    expect(options.onError).toHaveBeenCalledWith(boom);
    expect(options.onBusyChange).toHaveBeenLastCalledWith(false);

    expect(runner.run(VALIDATED)).toBe(true);
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  describe("an edit made while the upload runs", () => {
    test("does not change what is submitted: the validated snapshot is sent, not the card's state after the upload", async () => {
      // The block as the respondent has it, edited by the test while the upload is pending.
      const live: Record<string, string> = { email: "ada@example.com" };
      const upload = deferred<ContributedAnswer>();
      const { runner, options } = setup({
        getContributors: () => contributors({ sig: contributor({ resolveAnswer: () => upload.promise }) }),
      });

      // Next pressed: validation passed on this snapshot.
      runner.run({ ...live, sig: PENDING_ANSWER });
      // The respondent clears the required email while "Uploading..." shows. This is the edit that used to
      // reach the server as an empty required answer and lose the whole response.
      live.email = "";
      upload.resolve({ ok: true, data: { sig: STORED } });
      await settle();

      expect(options.onSubmit).toHaveBeenCalledTimes(1);
      expect(options.onSubmit).toHaveBeenCalledWith({ email: "ada@example.com", sig: STORED });
    });

    test("an edit that only makes the live state invalid cannot turn the submit into a rejected one", async () => {
      const upload = deferred<ContributedAnswer>();
      const validated = { email: "ada@example.com", sig: PENDING_ANSWER };
      const { runner, options } = setup({
        getContributors: () => contributors({ sig: contributor({ resolveAnswer: () => upload.promise }) }),
      });
      runner.run(validated);
      // Even the snapshot object itself being mutated afterwards (a caller reusing it) does not leak in.
      validated.email = "";
      upload.resolve({ ok: true, data: { sig: STORED } });
      await settle();
      expect(options.onSubmit).toHaveBeenCalledWith({ email: "ada@example.com", sig: STORED });
    });

    test("the contributor's own answer is frozen when Next is pressed: a later redraw or clear is not what is uploaded", async () => {
      let held = "strokes-as-validated";
      const uploaded: string[] = [];
      const editable: SubmitContributor = {
        hasAnswer: () => held !== "",
        capture: () => {
          const frozen = held;
          return async () => {
            await Promise.resolve();
            uploaded.push(frozen);
            return { ok: true as const, data: { sig: `/storage/${frozen}.png` } };
          };
        },
      };
      const { runner, options } = setup({ getContributors: () => contributors({ sig: editable }) });

      runner.run(VALIDATED);
      held = ""; // cleared right after Next
      await settle();

      expect(uploaded).toEqual(["strokes-as-validated"]);
      expect(options.onSubmit).toHaveBeenCalledWith({ other: "x", sig: "/storage/strokes-as-validated.png" });
    });

    test("with two Signatures every one is frozen at Next, including the one that is only uploaded second", async () => {
      const state = { first: "first-as-validated", second: "second-as-validated" };
      const captureOrder: string[] = [];
      const uploadOrder: string[] = [];
      const make = (key: "first" | "second"): SubmitContributor => ({
        hasAnswer: () => state[key] !== "",
        capture: () => {
          const frozen = state[key];
          captureOrder.push(key);
          return async () => {
            await settle();
            uploadOrder.push(frozen);
            return { ok: true as const, data: { [key]: `/storage/${frozen}.png` } };
          };
        },
      });
      const { runner, options } = setup({
        getContributors: () => contributors({ first: make("first"), second: make("second") }),
      });

      runner.run({ other: "x", first: PENDING_ANSWER, second: PENDING_ANSWER });
      // Both are captured before the first upload has even started; the second is then edited while the first uploads.
      expect(captureOrder).toEqual(["first", "second"]);
      state.second = "";
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(uploadOrder).toEqual(["first-as-validated", "second-as-validated"]);
      expect(options.onSubmit).toHaveBeenCalledWith({
        other: "x",
        first: "/storage/first-as-validated.png",
        second: "/storage/second-as-validated.png",
      });
    });

    test("the submit still uses the snapshot when the element unregisters mid-upload", async () => {
      const map = new Map<string, SubmitContributor>();
      const upload = deferred<ContributedAnswer>();
      map.set("sig", contributor({ resolveAnswer: () => upload.promise }));
      const { runner, options } = setup({ getContributors: () => map });
      runner.run(VALIDATED);
      map.delete("sig"); // the card re-rendered and re-registered, or the element went away
      map.set("sig", contributor());
      upload.resolve({ ok: true, data: { sig: STORED } });
      await settle();
      expect(options.onSubmit).toHaveBeenCalledWith({ other: "x", sig: STORED });
    });

    test("a block that is gone (respondent left the card) never submits, whatever was edited", async () => {
      const upload = deferred<ContributedAnswer>();
      const { runner, options, unmount } = setup({
        getContributors: () => contributors({ sig: contributor({ resolveAnswer: () => upload.promise }) }),
      });
      runner.run(VALIDATED);
      unmount();
      upload.resolve({ ok: true, data: { sig: STORED } });
      await settle();
      expect(options.onSubmit).not.toHaveBeenCalled();
    });
  });

  test("a contributor that throws while being frozen is reported and does not leave the block locked", async () => {
    const boom = new Error("capture failed");
    const { runner, options } = setup({
      getContributors: () =>
        contributors({
          sig: {
            hasAnswer: () => true,
            capture: () => {
              throw boom;
            },
          },
        }),
    });
    expect(runner.run(VALIDATED)).toBe(true);
    expect(options.onError).toHaveBeenCalledWith(boom);
    expect(options.onSubmit).not.toHaveBeenCalled();
    expect(options.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(runner.run(VALIDATED)).toBe(true);
  });
});
