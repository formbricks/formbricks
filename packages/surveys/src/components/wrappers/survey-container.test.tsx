import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SurveyContainer } from "./survey-container";

// Mock cn utility
vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

const TestChild = () => <div data-testid="test-child">Test Child</div>;

describe("SurveyContainer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders null when isOpen is false initially", () => {
    const { container } = render(
      <SurveyContainer isOpen={false} mode="modal">
        {(<TestChild />) as any}
      </SurveyContainer>
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders children when isOpen is true initially", () => {
    render(
      <SurveyContainer isOpen={true} mode="modal">
        {(<TestChild />) as any}
      </SurveyContainer>
    );
    expect(screen.getByTestId("test-child")).toBeInTheDocument();
  });

  test("hides when isOpen prop changes to false", () => {
    const { rerender, container } = render(
      <SurveyContainer isOpen={true} mode="modal">
        {(<TestChild />) as any}
      </SurveyContainer>
    );
    expect(screen.getByTestId("test-child")).toBeInTheDocument();

    rerender(
      <SurveyContainer isOpen={false} mode="modal">
        {(<TestChild />) as any}
      </SurveyContainer>
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("test-child")).not.toBeInTheDocument();
  });

  test("shows when isOpen prop changes to true after being false", () => {
    const { rerender } = render(
      <SurveyContainer isOpen={false} mode="modal">
        {(<TestChild />) as any}
      </SurveyContainer>
    );
    expect(screen.queryByTestId("test-child")).not.toBeInTheDocument();

    rerender(
      <SurveyContainer isOpen={true} mode="modal">
        {(<TestChild />) as any}
      </SurveyContainer>
    );
    expect(screen.getByTestId("test-child")).toBeInTheDocument();
  });

  describe("Inline Mode", () => {
    test("renders correctly in inline mode", () => {
      render(<SurveyContainer mode="inline">{(<TestChild />) as any}</SurveyContainer>);
      const containerDiv = screen.getByTestId("test-child").parentElement;
      expect(containerDiv).toHaveAttribute("id", "fbjs");
      expect(containerDiv).toHaveClass("fb-formbricks-form");
      expect(containerDiv).toHaveStyle({ height: "100%", width: "100%" });
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });
  });

  describe("Modal Mode", () => {
    test("renders children in modal mode", () => {
      render(<SurveyContainer mode="modal">{(<TestChild />) as any}</SurveyContainer>);
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      // Select the background div which should have fb-relative
      const modalBackgroundDiv = screen.getByTestId("test-child").parentElement?.parentElement?.parentElement;
      expect(modalBackgroundDiv).toHaveClass("fb-relative");
    });

    test("applies dark overlay when darkOverlay is true", () => {
      render(
        // Added placement="center" as darkOverlay class fb-bg-slate-700/80 is applied only when centered
        <SurveyContainer mode="modal" darkOverlay={true} placement="center">
          {(<TestChild />) as any}
        </SurveyContainer>
      );
      // The overlay class is on the background div (parent of modalRef)
      const overlayDiv = screen.getByTestId("test-child").parentElement?.parentElement?.parentElement;
      expect(overlayDiv).toHaveClass("fb-bg-slate-700/80"); // Updated class name
    });

    test("does not apply dark overlay when darkOverlay is false", () => {
      render(
        <SurveyContainer mode="modal" darkOverlay={false} placement="center">
          {(<TestChild />) as any}
        </SurveyContainer>
      );
      const overlayHostDiv = screen.getByTestId("test-child").parentElement?.parentElement?.parentElement;
      // It should have fb-bg-white/50 when darkOverlay is false and placement is center
      expect(overlayHostDiv).toHaveClass("fb-bg-white/50");
      expect(overlayHostDiv).not.toHaveClass("fb-bg-slate-700/80");
      expect(overlayHostDiv).not.toHaveClass("fb-bg-black fb-bg-opacity-50");
    });

    const placements: {
      name: "bottomRight" | "topRight" | "topLeft" | "bottomLeft" | "center";
      expectedClasses: string[];
      outerExpectedClasses?: string[];
    }[] = [
      { name: "bottomRight", expectedClasses: ["sm:fb-bottom-3", "sm:fb-right-3"] },
      { name: "topRight", expectedClasses: ["sm:fb-top-3", "sm:fb-right-3", "sm:fb-bottom-3"] },
      { name: "topLeft", expectedClasses: ["sm:fb-top-3", "sm:fb-left-3", "sm:fb-bottom-3"] },
      { name: "bottomLeft", expectedClasses: ["sm:fb-bottom-3", "sm:fb-left-3"] },
    ];

    placements.forEach((p) => {
      test(`applies ${p.name} placement style`, () => {
        render(
          <SurveyContainer mode="modal" placement={p.name}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        // Placement classes are on the modalRef div itself
        const modalRefDiv = screen.getByTestId("test-child").parentElement?.parentElement;
        p.expectedClasses.forEach((cls) => expect(modalRefDiv).toHaveClass(cls));

        if (p.outerExpectedClasses) {
          // Outer classes are on the parent of modalRef div (the background div)
          const outerDiv = modalRefDiv?.parentElement;
          p.outerExpectedClasses.forEach((cls) => expect(outerDiv).toHaveClass(cls));
        }
      });
    });

    test("applies default (bottomRight) placement style when placement is undefined", () => {
      render(<SurveyContainer mode="modal">{(<TestChild />) as any}</SurveyContainer>);
      // Placement classes are on the modalRef div
      const modalRefDiv = screen.getByTestId("test-child").parentElement?.parentElement;
      expect(modalRefDiv).toHaveClass("sm:fb-bottom-3");
      expect(modalRefDiv).toHaveClass("sm:fb-right-3");
    });

    describe("Click Outside Logic (placement='center')", () => {
      let onCloseMock: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        onCloseMock = vi.fn();
      });

      test("calls onClose when clicking outside the modal", () => {
        render(
          <SurveyContainer mode="modal" placement="center" clickOutside={true} onClose={onCloseMock}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        // Click on the overlay (background div, parent of modalRef's div)
        fireEvent.mouseDown(screen.getByTestId("test-child").parentElement!.parentElement!.parentElement!);
        expect(onCloseMock).toHaveBeenCalledTimes(1);
      });

      test("does not call onClose when clicking inside the modal", () => {
        render(
          <SurveyContainer mode="modal" placement="center" clickOutside={true} onClose={onCloseMock}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        fireEvent.mouseDown(screen.getByTestId("test-child"));
        expect(onCloseMock).not.toHaveBeenCalled();
      });

      test("does not call onClose when clickOutside is false", () => {
        render(
          <SurveyContainer mode="modal" placement="center" clickOutside={false} onClose={onCloseMock}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        fireEvent.mouseDown(screen.getByTestId("test-child").parentElement!.parentElement!.parentElement!);
        expect(onCloseMock).not.toHaveBeenCalled();
      });

      test("does not call onClose if onClose is not provided", () => {
        expect(() => {
          render(
            <SurveyContainer mode="modal" placement="center" clickOutside={true}>
              {(<TestChild />) as any}
            </SurveyContainer>
          );
          fireEvent.mouseDown(screen.getByTestId("test-child").parentElement!.parentElement!.parentElement!);
        }).not.toThrow();
        expect(onCloseMock).not.toHaveBeenCalled(); // Mock from previous test scope, ensure it's not called
      });

      test("does not trigger clickOutside logic if placement is not center", () => {
        render(
          <SurveyContainer mode="modal" placement="bottomRight" clickOutside={true} onClose={onCloseMock}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        fireEvent.mouseDown(document.body); // General click
        expect(onCloseMock).not.toHaveBeenCalled();
      });

      test("triggers clickOutside logic if ignorePlacementForClickOutside is true and placement is not center", () => {
        render(
          <SurveyContainer
            mode="modal"
            placement="bottomRight"
            clickOutside={true}
            onClose={onCloseMock}
            ignorePlacementForClickOutside={true}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        fireEvent.mouseDown(document.body);
        expect(onCloseMock).toHaveBeenCalled();
      });

      test("does not trigger clickOutside logic if ignorePlacementForClickOutside is true and placement is center", () => {
        render(
          <SurveyContainer
            mode="modal"
            placement="center"
            clickOutside={false}
            onClose={onCloseMock}
            ignorePlacementForClickOutside={true}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        fireEvent.mouseDown(document.body);
        expect(onCloseMock).not.toHaveBeenCalled();
      });

      test("does not trigger clickOutside logic if mode is not modal", () => {
        render(
          <SurveyContainer mode="inline" placement="center" clickOutside={true} onClose={onCloseMock}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        fireEvent.mouseDown(document.body);
        expect(onCloseMock).not.toHaveBeenCalled();
      });

      test("removes event listener on unmount", () => {
        const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
        const { unmount } = render(
          <SurveyContainer mode="modal" placement="center" clickOutside={true} onClose={onCloseMock}>
            {(<TestChild />) as any}
          </SurveyContainer>
        );
        // At this point, addEventListener should have been called for 'mousedown'
        // We can't easily check the exact handler function without more complex mocking
        // So we rely on testing the unmount behavior.

        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
      });

      test("does not call onClose when modal is not shown (show=false)", () => {
        render(
          <SurveyContainer
            mode="modal"
            placement="center"
            clickOutside={true}
            onClose={onCloseMock}
            isOpen={true} // initially open
          >
            {(<TestChild />) as any}
          </SurveyContainer>
        );

        // Manually set show to false by re-rendering with isOpen=false
        // This is a bit indirect for testing the 'show' condition within handleClickOutside
        // but ensures the effect's dependency on 'show' is covered.
        // A more direct test would involve internal state manipulation which is not ideal.
        cleanup(); // clean previous render
        render(
          <SurveyContainer
            mode="modal"
            placement="center"
            clickOutside={true}
            onClose={onCloseMock}
            isOpen={false} // now closed
          >
            {(<TestChild />) as any}
          </SurveyContainer>
        );

        fireEvent.mouseDown(document.body);
        expect(onCloseMock).not.toHaveBeenCalled();
      });
    });
  });
});
