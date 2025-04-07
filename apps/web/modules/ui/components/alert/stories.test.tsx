import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Default, Error, Info, Small, Success, Warning, withButtonAndIcon } from "./stories";

describe("Alert Stories", () => {
  const renderStory = (Story: any) => {
    return render(Story.render(Story.args));
  };

  afterEach(() => {
    cleanup();
  });

  it("renders Default story", () => {
    renderStory(Default);
    expect(screen.getByText("Alert Title")).toBeInTheDocument();
    expect(screen.getByText("This is an important notification.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders Small story", () => {
    renderStory(Small);
    expect(screen.getByText("Information Alert")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Learn more")).toBeInTheDocument();
  });

  it("renders withButtonAndIcon story", () => {
    renderStory(withButtonAndIcon);
    expect(screen.getByText("Alert Title")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Learn more")).toBeInTheDocument();
  });

  it("renders Error story", () => {
    renderStory(Error);
    expect(screen.getByText("Error Alert")).toBeInTheDocument();
    expect(screen.getByText("Your session has expired. Please log in again.")).toBeInTheDocument();
    expect(screen.getByText("Log in")).toBeInTheDocument();
  });

  it("renders Warning story", () => {
    renderStory(Warning);
    expect(screen.getByText("Warning Alert")).toBeInTheDocument();
    expect(screen.getByText("You are editing sensitive data. Be cautious")).toBeInTheDocument();
    expect(screen.getByText("Proceed")).toBeInTheDocument();
  });

  it("renders Info story", () => {
    renderStory(Info);
    expect(screen.getByText("Info Alert")).toBeInTheDocument();
    expect(screen.getByText("There was an update to your application.")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("renders Success story", () => {
    renderStory(Success);
    expect(screen.getByText("Success Alert")).toBeInTheDocument();
    expect(screen.getByText("This worked! Please proceed.")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
