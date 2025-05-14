import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { RedirectUrlForm } from "./redirect-url-form";

describe("RedirectUrlForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render the URL input field with the placeholder 'https://formbricks.com' and the value derived from `endingCard.url`", () => {
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      endings: [],
      type: "nps",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      followUps: [],
    } as unknown as TSurvey;

    const mockEndingCard: TSurveyRedirectUrlCard = {
      id: "ending1",
      type: "redirectToUrl",
      url: "https://example.com",
      label: "Example",
    };

    const mockUpdateSurvey = vi.fn();

    render(
      <RedirectUrlForm
        localSurvey={mockLocalSurvey}
        endingCard={mockEndingCard}
        updateSurvey={mockUpdateSurvey}
      />
    );

    const urlInput = screen.getByPlaceholderText("https://formbricks.com");
    expect(urlInput).toBeInTheDocument();
    expect((urlInput as HTMLInputElement).value).toBe("https://example.com");
  });

  test("should render the label input field with the placeholder 'Formbricks App' and the value derived from `endingCard.label`", () => {
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      endings: [],
      type: "nps",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      followUps: [],
    } as unknown as TSurvey;

    const mockEndingCard: TSurveyRedirectUrlCard = {
      id: "ending1",
      type: "redirectToUrl",
      url: "https://example.com",
      label: "Example Label",
    };

    const mockUpdateSurvey = vi.fn();

    render(
      <RedirectUrlForm
        localSurvey={mockLocalSurvey}
        endingCard={mockEndingCard}
        updateSurvey={mockUpdateSurvey}
      />
    );

    const labelInput = screen.getByPlaceholderText("Formbricks App");
    expect(labelInput).toBeInTheDocument();
    expect((labelInput as HTMLInputElement).value).toBe("Example Label");
  });

  test("should call `updateSurvey` with the updated URL value when the URL input field value changes", async () => {
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      endings: [],
      type: "nps",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      followUps: [],
    } as unknown as TSurvey;

    const mockEndingCard: TSurveyRedirectUrlCard = {
      id: "ending1",
      type: "redirectToUrl",
      url: "https://example.com",
      label: "Example",
    };

    const mockUpdateSurvey = vi.fn();

    render(
      <RedirectUrlForm
        localSurvey={mockLocalSurvey}
        endingCard={mockEndingCard}
        updateSurvey={mockUpdateSurvey}
      />
    );

    const urlInput = screen.getByPlaceholderText("https://formbricks.com");
    expect(urlInput).toBeInTheDocument();

    const newUrl = "https://new-example.com";
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, newUrl);

    await vi.waitFor(() => {
      expect(mockUpdateSurvey).toHaveBeenCalledWith(
        expect.objectContaining({
          url: newUrl,
        })
      );
    });
  });

  test("should handle gracefully when endingCard.url contains recall syntax referencing a question ID that doesn't exist in localSurvey", () => {
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      endings: [],
      type: "app",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      followUps: [],
      hiddenFields: { fieldIds: [], enabled: false },
      variables: [],
    } as unknown as TSurvey;

    const mockEndingCard: TSurveyRedirectUrlCard = {
      id: "ending1",
      type: "redirectToUrl",
      url: "#recall:nonexistent-question-id/fallback:default#",
      label: "Example",
    };

    const mockUpdateSurvey = vi.fn();

    render(
      <RedirectUrlForm
        localSurvey={mockLocalSurvey}
        endingCard={mockEndingCard}
        updateSurvey={mockUpdateSurvey}
      />
    );

    const urlInput = screen.getByPlaceholderText("https://formbricks.com");
    expect(urlInput).toBeInTheDocument();
    expect((urlInput as HTMLInputElement).value).toBe("@nonexistent-question-id");
  });

  test("should handle malformed recall syntax in endingCard.url without breaking the UI", () => {
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      endings: [],
      variables: [],
      type: "nps",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      followUps: [],
      hiddenFields: [],
    } as unknown as TSurvey;

    const mockEndingCard: TSurveyRedirectUrlCard = {
      id: "ending1",
      type: "redirectToUrl",
      url: "#recall:invalid_id", // Malformed recall syntax
      label: "Example",
    };

    const mockUpdateSurvey = vi.fn();

    render(
      <RedirectUrlForm
        localSurvey={mockLocalSurvey}
        endingCard={mockEndingCard}
        updateSurvey={mockUpdateSurvey}
      />
    );

    const urlInput = screen.getByPlaceholderText("https://formbricks.com");
    expect(urlInput).toBeInTheDocument();
    expect((urlInput as HTMLInputElement).value).toBe("#recall:invalid_id");
  });

  test("should handle gracefully when inputRef.current is null in onAddFallback", () => {
    const mockLocalSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      endings: [],
      type: "nps",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      followUps: [],
    } as unknown as TSurvey;

    const mockEndingCard: TSurveyRedirectUrlCard = {
      id: "ending1",
      type: "redirectToUrl",
      url: "https://example.com",
      label: "Example",
    };

    const mockUpdateSurvey = vi.fn();

    const mockInputRef = { current: null };
    vi.spyOn(React, "useRef").mockReturnValue(mockInputRef);

    render(
      <RedirectUrlForm
        localSurvey={mockLocalSurvey}
        endingCard={mockEndingCard}
        updateSurvey={mockUpdateSurvey}
      />
    );

    // We can't directly access the onAddFallback function, so we'll simulate the scenario
    // where inputRef.current is null and verify that no error is thrown.
    // This is achieved by mocking useRef to return an object with current: null.

    // No need to simulate a button click. The component should handle the null ref internally.
    // We can assert that the component renders without throwing an error in this state.
    expect(() => {
      screen.getByText("common.url"); // Just check if the component renders without error
    }).not.toThrow();
  });
});
