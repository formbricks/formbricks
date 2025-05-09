import { getUpdatedTtc } from "@/lib/ttc";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyAddressQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { AddressQuestion } from "./address-question";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi
    .fn()
    .mockImplementation((val, lang) => (typeof val === "object" ? val[lang] || val.default : val)),
}));

vi.mock("@/lib/ttc", () => ({
  getUpdatedTtc: vi.fn().mockReturnValue({}),
  useTtc: vi.fn(),
}));

const mockOnChange = vi.fn();
const mockOnSubmit = vi.fn();
const mockOnBack = vi.fn();
const mockSetTtc = vi.fn();

describe("AddressQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockQuestion: TSurveyAddressQuestion = {
    id: "address-1",
    type: TSurveyQuestionTypeEnum.Address,
    headline: { default: "Address Question" },
    subheader: { default: "Enter your address" },
    required: true,
    buttonLabel: { default: "Submit" },
    backButtonLabel: { default: "Back" },
    addressLine1: { show: true, required: false, placeholder: { default: "Address Line 1" } },
    addressLine2: { show: true, required: false, placeholder: { default: "Address Line 2" } },
    city: { show: true, required: false, placeholder: { default: "City" } },
    state: { show: true, required: false, placeholder: { default: "State" } },
    zip: { show: true, required: false, placeholder: { default: "ZIP" } },
    country: { show: true, required: false, placeholder: { default: "Country" } },
  };

  test("renders the address question with all fields", () => {
    render(
      <AddressQuestion
        question={mockQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    expect(screen.getByText("Address Question")).toBeInTheDocument();
    expect(screen.getByText("Enter your address")).toBeInTheDocument();
    expect(screen.getByText("Address Line 1*")).toBeInTheDocument();
    expect(screen.getByText("Address Line 2*")).toBeInTheDocument();
    expect(screen.getByText("City*")).toBeInTheDocument();
    expect(screen.getByText("State*")).toBeInTheDocument();
    expect(screen.getByText("ZIP*")).toBeInTheDocument();
    expect(screen.getByText("Country*")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  test("renders question with media when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "https://example.com/image.jpg",
    };

    render(
      <AddressQuestion
        question={questionWithMedia}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  test("updates value when fields are changed", async () => {
    const user = userEvent.setup();

    render(
      <AddressQuestion
        question={mockQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    const addressLine1Input = screen.getByLabelText("Address Line 1*");
    await user.type(addressLine1Input, "123 Main St");

    expect(mockOnChange).toHaveBeenCalledWith({
      "address-1": ["123 Main St", "", "", "", "", ""],
    });
  });

  test("submits data when form is submitted", async () => {
    const user = userEvent.setup();
    vi.mocked(getUpdatedTtc).mockReturnValue({ "address-1": 1000 });

    render(
      <AddressQuestion
        question={mockQuestion}
        value={["123 Main St", "Apt 4", "City", "State", "12345", "Country"]}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    const submitButton = screen.getByText("Submit");
    await user.click(submitButton);

    expect(getUpdatedTtc).toHaveBeenCalled();
    expect(mockSetTtc).toHaveBeenCalledWith({ "address-1": 1000 });
    expect(mockOnSubmit).toHaveBeenCalledWith(
      { "address-1": ["123 Main St", "Apt 4", "City", "State", "12345", "Country"] },
      { "address-1": 1000 }
    );
  });

  test("submits empty array when all fields are empty", async () => {
    const user = userEvent.setup();
    vi.mocked(getUpdatedTtc).mockReturnValue({ "address-1": 1000 });

    // Create a modified question with no required fields to allow empty submission
    const nonRequiredQuestion = {
      ...mockQuestion,
      required: false,
      addressLine1: { ...mockQuestion.addressLine1, required: false },
      addressLine2: { ...mockQuestion.addressLine2, required: false },
      city: { ...mockQuestion.city, required: false },
      state: { ...mockQuestion.state, required: false },
      zip: { ...mockQuestion.zip, required: false },
      country: { ...mockQuestion.country, required: false },
    };

    render(
      <AddressQuestion
        question={nonRequiredQuestion}
        value={["", "", "", "", "", ""]}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    const submitButton = screen.getByRole("button", { name: "Submit" });
    await user.click(submitButton);

    expect(getUpdatedTtc).toHaveBeenCalled();
    expect(mockSetTtc).toHaveBeenCalledWith({ "address-1": 1000 });
    expect(mockOnSubmit).toHaveBeenCalledWith({ "address-1": [] }, { "address-1": 1000 });
  });

  test("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(getUpdatedTtc).mockReturnValue({ "address-1": 500 });

    render(
      <AddressQuestion
        question={mockQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    const backButton = screen.getByText("Back");
    await user.click(backButton);

    expect(getUpdatedTtc).toHaveBeenCalled();
    expect(mockSetTtc).toHaveBeenCalledWith({ "address-1": 500 });
    expect(mockOnBack).toHaveBeenCalled();
  });

  test("doesn't render back button when isFirstQuestion is true", () => {
    render(
      <AddressQuestion
        question={mockQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={true}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("handles field visibility based on question config", () => {
    const customQuestion = {
      ...mockQuestion,
      addressLine2: { ...mockQuestion.addressLine2, show: false },
      state: { ...mockQuestion.state, show: false },
    };

    render(
      <AddressQuestion
        question={customQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    expect(screen.getByLabelText("Address Line 1*")).toBeInTheDocument();
    expect(screen.queryByLabelText("Address Line 2")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("State*")).not.toBeInTheDocument();
    expect(screen.getByLabelText("City*")).toBeInTheDocument();
  });

  test("handles required fields correctly", () => {
    const customQuestion = {
      ...mockQuestion,
      required: false,
      addressLine1: { ...mockQuestion.addressLine1, required: true },
    };

    render(
      <AddressQuestion
        question={customQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    expect(screen.getByLabelText("Address Line 1*")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument(); // Not required anymore
  });

  test("auto focuses the first field when autoFocusEnabled is true", () => {
    render(
      <AddressQuestion
        question={mockQuestion}
        onChange={mockOnChange}
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        isFirstQuestion={false}
        isLastQuestion={false}
        languageCode="default"
        ttc={{}}
        setTtc={mockSetTtc}
        currentQuestionId="address-1"
        autoFocusEnabled={true}
        isBackButtonHidden={false}
      />
    );

    const addressLine1Input = screen.getByLabelText("Address Line 1*");
    expect(document.activeElement).toBe(addressLine1Input);
  });
});
