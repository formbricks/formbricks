import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { type ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useFocusTrap } from "./use-focus-trap";

const FocusTrapFixture = ({
  children,
  enabled = true,
  onEscapeKeyDown,
  withTabIndex = true,
}: {
  children: ComponentChildren;
  enabled?: boolean;
  onEscapeKeyDown?: () => void;
  withTabIndex?: boolean;
}) => {
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ enabled, onEscapeKeyDown });

  return (
    <>
      <button>Host page button</button>
      <div ref={focusTrapRef} tabIndex={withTabIndex ? -1 : undefined}>
        {children}
      </div>
    </>
  );
};

const FocusTrapUnmountFixture = ({
  showTrap,
  onEscapeKeyDown,
}: {
  showTrap: boolean;
  onEscapeKeyDown?: () => void;
}) => (
  <>
    <button>External host button</button>
    {showTrap ? (
      <FocusTrapFixture onEscapeKeyDown={onEscapeKeyDown}>
        <button>Survey action</button>
      </FocusTrapFixture>
    ) : null}
  </>
);

// Mimics a host page that runs its own focus manager (another focus trap, a modal from the embedding
// app) and pushes focus back out every time it lands inside the survey.
const CompetingFocusManagerFixture = ({
  onCompetingRedirect,
  reactAsynchronously = false,
}: {
  onCompetingRedirect: () => void;
  reactAsynchronously?: boolean;
}) => {
  const focusTrapRef = useFocusTrap<HTMLDivElement>({ enabled: true });
  const outsideButtonRef = useRef<HTMLButtonElement>(null);
  const onCompetingRedirectRef = useRef(onCompetingRedirect);

  useEffect(() => {
    onCompetingRedirectRef.current = onCompetingRedirect;
  }, [onCompetingRedirect]);

  useEffect(() => {
    const takeFocusOut = () => {
      const outsideButton = outsideButtonRef.current;
      if (!outsideButton) return;

      onCompetingRedirectRef.current();
      outsideButton.focus();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const container = focusTrapRef.current;
      const target = event.target as HTMLElement | null;

      if (!container || !target) return;
      if (!container.contains(target)) return;

      if (reactAsynchronously) {
        setTimeout(takeFocusOut, 0);
        return;
      }

      takeFocusOut();
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [focusTrapRef, reactAsynchronously]);

  return (
    <>
      <button>Host page button</button>
      <button ref={outsideButtonRef}>Competing manager target</button>
      <div ref={focusTrapRef} tabIndex={-1}>
        <button>Survey action</button>
      </div>
    </>
  );
};

describe("useFocusTrap", () => {
  afterEach(() => {
    cleanup();
  });

  test("focuses the first tabbable element when active", async () => {
    render(
      <FocusTrapFixture>
        <button>First action</button>
        <button>Last action</button>
      </FocusTrapFixture>
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "First action" }));
    });
  });

  test("makes the trap root focusable when it has no tabIndex", async () => {
    render(
      <FocusTrapFixture withTabIndex={false}>
        <span>Static content</span>
      </FocusTrapFixture>
    );

    await waitFor(() => {
      expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
    });
  });

  test("allows links to receive initial focus", async () => {
    render(
      <FocusTrapFixture>
        <a href="https://formbricks.com">Formbricks link</a>
        <button>Survey action</button>
      </FocusTrapFixture>
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Formbricks link" }));
    });
  });

  test("keeps tab focus inside the trap", async () => {
    render(
      <FocusTrapFixture>
        <button>First action</button>
        <button>Last action</button>
      </FocusTrapFixture>
    );

    const firstButton = screen.getByRole("button", { name: "First action" });
    const lastButton = screen.getByRole("button", { name: "Last action" });

    await waitFor(() => {
      expect(document.activeElement).toBe(firstButton);
    });

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(firstButton);
  });

  test("keeps focus from moving outside the trap", async () => {
    render(
      <FocusTrapFixture>
        <button>Survey action</button>
      </FocusTrapFixture>
    );

    const trappedButton = screen.getByRole("button", { name: "Survey action" });
    const hostPageButton = screen.getByRole("button", { name: "Host page button" });

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });

    hostPageButton.focus();

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });
  });

  test("calls the Escape handler when provided", async () => {
    const handleEscapeKeyDown = vi.fn();

    render(
      <FocusTrapFixture onEscapeKeyDown={handleEscapeKeyDown}>
        <button>Survey action</button>
      </FocusTrapFixture>
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Survey action" }));
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(handleEscapeKeyDown).toHaveBeenCalledTimes(1);
  });

  test("restores focus to the previously focused element on unmount", async () => {
    const initialEscapeHandler = vi.fn();
    const updatedEscapeHandler = vi.fn();
    const { rerender } = render(
      <FocusTrapUnmountFixture showTrap={false} onEscapeKeyDown={initialEscapeHandler} />
    );

    const hostButton = screen.getByRole("button", { name: "External host button" });

    hostButton.focus();

    rerender(<FocusTrapUnmountFixture showTrap={true} onEscapeKeyDown={initialEscapeHandler} />);

    const trappedButton = screen.getByRole("button", { name: "Survey action" });

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });

    rerender(<FocusTrapUnmountFixture showTrap={true} onEscapeKeyDown={updatedEscapeHandler} />);
    rerender(<FocusTrapUnmountFixture showTrap={false} onEscapeKeyDown={updatedEscapeHandler} />);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "External host button" }));
    });
  });

  test("re-traps focus when focusout has no related target", async () => {
    render(
      <FocusTrapFixture>
        <button>Survey action</button>
      </FocusTrapFixture>
    );

    const trappedButton = screen.getByRole("button", { name: "Survey action" });
    const hostPageButton = screen.getByRole("button", { name: "Host page button" });

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });

    fireEvent.focusOut(trappedButton, { relatedTarget: null });
    hostPageButton.focus();

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });
  });

  test("falls back to a connected element when the last focused node was removed", async () => {
    const { rerender } = render(
      <FocusTrapFixture>
        <button>First action</button>
        <button>Last action</button>
      </FocusTrapFixture>
    );

    const firstButton = screen.getByRole("button", { name: "First action" });
    const lastButton = screen.getByRole("button", { name: "Last action" });
    const hostPageButton = screen.getByRole("button", { name: "Host page button" });

    await waitFor(() => {
      expect(document.activeElement).toBe(firstButton);
    });

    lastButton.focus();

    await waitFor(() => {
      expect(document.activeElement).toBe(lastButton);
    });

    rerender(
      <FocusTrapFixture>
        <button>First action</button>
      </FocusTrapFixture>
    );

    hostPageButton.focus();

    await waitFor(() => {
      expect(document.activeElement).toBe(firstButton);
    });
  });

  test("skips disabled, hidden, and inert candidates", async () => {
    render(
      <FocusTrapFixture>
        <button disabled>Disabled action</button>
        <button hidden>Hidden action</button>
        <div
          ref={(element) => {
            element?.setAttribute("inert", "");
          }}>
          <button>Inert action</button>
        </div>
        <button>Enabled action</button>
      </FocusTrapFixture>
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Enabled action" }));
    });
  });

  test("gives up instead of recursing when the page fights it for focus", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onCompetingRedirect = vi.fn();

    render(<CompetingFocusManagerFixture onCompetingRedirect={onCompetingRedirect} />);

    const trappedButton = screen.getByRole("button", { name: "Survey action" });
    const hostPageButton = screen.getByRole("button", { name: "Host page button" });
    const trapContainer = trappedButton.parentElement as HTMLElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });

    // Every round the trap pulls focus back in and the competing manager takes it straight out again.
    // Before the guards this recursed until "Maximum call stack size exceeded".
    for (let round = 0; round < 5; round++) {
      hostPageButton.focus();
      await Promise.resolve();
    }

    expect(onCompetingRedirect.mock.calls.length).toBeLessThan(20);
    expect(warnSpy).toHaveBeenCalled();
    expect(trapContainer.contains(document.activeElement)).toBe(false);

    warnSpy.mockRestore();
  });

  test("stops the focus tug-of-war when the page fights back asynchronously", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onCompetingRedirect = vi.fn();

    render(<CompetingFocusManagerFixture onCompetingRedirect={onCompetingRedirect} reactAsynchronously />);

    const trappedButton = screen.getByRole("button", { name: "Survey action" });
    const hostPageButton = screen.getByRole("button", { name: "Host page button" });

    await waitFor(() => {
      expect(document.activeElement).toBe(trappedButton);
    });

    // An async competing manager cannot overflow the stack, but it can keep the two sides swapping
    // focus forever. The trap has to run out of redirect budget and back off.
    hostPageButton.focus();

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    const redirectsOnBackoff = onCompetingRedirect.mock.calls.length;
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(onCompetingRedirect.mock.calls.length).toBe(redirectsOnBackoff);

    warnSpy.mockRestore();
  });

  test("does not move focus when inactive", async () => {
    render(
      <FocusTrapFixture enabled={false}>
        <button>Survey action</button>
      </FocusTrapFixture>
    );

    await Promise.resolve();

    expect(document.activeElement).toBe(document.body);
  });
});
