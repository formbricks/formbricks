// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { type ComponentChildren } from "preact";
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
