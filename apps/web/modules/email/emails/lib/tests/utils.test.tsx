import { render, screen } from "@testing-library/react";
import { TFnType, TranslationKey } from "@tolgee/react";
import { describe, expect, test, vi } from "vitest";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { renderEmailResponseValue } from "../utils";

// Mock the components from @react-email/components to avoid dependency issues
vi.mock("@react-email/components", () => ({
  Text: ({ children, className }) => <p className={className}>{children}</p>,
  Container: ({ children }) => <div>{children}</div>,
  Row: ({ children, className }) => <div className={className}>{children}</div>,
  Column: ({ children, className }) => <div className={className}>{children}</div>,
  Link: ({ children, href }) => <a href={href}>{children}</a>,
  Img: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
}));

// Mock dependencies
vi.mock("@/lib/storage/utils", () => ({
  getOriginalFileNameFromUrl: (url: string) => {
    // Extract filename from the URL for testing purposes
    const parts = url.split("/");
    return parts[parts.length - 1];
  },
}));

// Mock translation function
const mockTranslate = (key: TranslationKey) => key;

describe("renderEmailResponseValue", () => {
  describe("FileUpload question type", () => {
    test("renders clickable file upload links with file icons and truncated file names when overrideFileUploadResponse is false", async () => {
      // Arrange
      const fileUrls = [
        "https://example.com/uploads/file1.pdf",
        "https://example.com/uploads/very-long-filename-that-should-be-truncated.docx",
      ];

      // Act
      const result = await renderEmailResponseValue(
        fileUrls,
        TSurveyQuestionTypeEnum.FileUpload,
        mockTranslate as unknown as TFnType,
        false
      );

      render(result);

      // Assert
      // Check if we have the correct number of links
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);

      // Check if links have correct hrefs
      expect(links[0]).toHaveAttribute("href", fileUrls[0]);
      expect(links[1]).toHaveAttribute("href", fileUrls[1]);

      // Check if file names are displayed
      expect(screen.getByText("file1.pdf")).toBeInTheDocument();
      expect(screen.getByText("very-long-filename-that-should-be-truncated.docx")).toBeInTheDocument();

      // Check for SVG icons (file icons)
      const svgElements = document.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThanOrEqual(2);
    });

    test("renders a message when overrideFileUploadResponse is true", async () => {
      // Arrange
      const fileUrls = ["https://example.com/uploads/file1.pdf"];
      const expectedMessage = "emails.render_email_response_value_file_upload_response_link_not_included";

      // Act
      const result = await renderEmailResponseValue(
        fileUrls,
        TSurveyQuestionTypeEnum.FileUpload,
        mockTranslate as unknown as TFnType,
        true
      );

      render(result);

      // Assert
      // Check that the override message is displayed
      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      expect(screen.getByText(expectedMessage)).toHaveClass(
        "mt-0",
        "break-words",
        "whitespace-pre-wrap",
        "italic",
        "text-sm"
      );
    });
  });

  describe("PictureSelection question type", () => {
    test("renders images with appropriate alt text and styling", async () => {
      // Arrange
      const imageUrls = [
        "https://example.com/images/sunset.jpg",
        "https://example.com/images/mountain.png",
        "https://example.com/images/beach.webp",
      ];

      // Act
      const result = await renderEmailResponseValue(
        imageUrls,
        TSurveyQuestionTypeEnum.PictureSelection,
        mockTranslate as unknown as TFnType
      );

      render(result);

      // Assert
      // Check if we have the correct number of images
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(3);

      // Check if images have correct src attributes
      expect(images[0]).toHaveAttribute("src", imageUrls[0]);
      expect(images[1]).toHaveAttribute("src", imageUrls[1]);
      expect(images[2]).toHaveAttribute("src", imageUrls[2]);

      // Check if images have correct alt text (extracted from URL)
      expect(images[0]).toHaveAttribute("alt", "sunset.jpg");
      expect(images[1]).toHaveAttribute("alt", "mountain.png");
      expect(images[2]).toHaveAttribute("alt", "beach.webp");

      // Check if images have the expected styling class
      expect(images[0]).toHaveAttribute("class", "m-2 h-28");
      expect(images[1]).toHaveAttribute("class", "m-2 h-28");
      expect(images[2]).toHaveAttribute("class", "m-2 h-28");
    });
  });

  describe("Ranking question type", () => {
    test("renders ranking responses with proper numbering and styling", async () => {
      // Arrange
      const rankingItems = ["First Choice", "Second Choice", "Third Choice"];

      // Act
      const result = await renderEmailResponseValue(
        rankingItems,
        TSurveyQuestionTypeEnum.Ranking,
        mockTranslate as unknown as TFnType
      );

      render(result);

      // Assert
      // Check if we have the correct number of ranking items
      const rankingElements = document.querySelectorAll(".mb-1");
      expect(rankingElements).toHaveLength(3);

      // Check if each item has the correct number and styling
      rankingItems.forEach((item, index) => {
        const itemElement = screen.getByText(item);
        expect(itemElement).toBeInTheDocument();
        expect(itemElement).toHaveClass("rounded", "bg-slate-100", "px-2", "py-1");

        // Check if the ranking number is present
        const rankNumber = screen.getByText(`#${index + 1}`);
        expect(rankNumber).toBeInTheDocument();
        expect(rankNumber).toHaveClass("text-slate-400");
      });
    });
  });

  describe("handling long text responses", () => {
    test("properly formats extremely long text responses with line breaks", async () => {
      // Arrange
      // Create a very long text response with multiple paragraphs and long words
      const longTextResponse = `This is the first paragraph of a very long response that might be submitted by a user in an open text question. It contains detailed information and feedback.

This is the second paragraph with an extremely long word: ${"supercalifragilisticexpialidocious".repeat(5)}

And here's a third paragraph with more text and some line
breaks within the paragraph itself to test if they are preserved properly.

${"This is a very long sentence that should wrap properly within the email layout and not break the formatting. ".repeat(10)}`;

      // Act
      const result = await renderEmailResponseValue(
        longTextResponse,
        TSurveyQuestionTypeEnum.OpenText,
        mockTranslate as unknown as TFnType
      );

      render(result);

      // Assert
      // Check if the text is rendered
      const textElement = screen.getByText(/This is the first paragraph/);
      expect(textElement).toBeInTheDocument();

      // Check if the extremely long word is rendered without breaking the layout
      expect(screen.getByText(/supercalifragilisticexpialidocious/)).toBeInTheDocument();

      // Verify the text element has the proper CSS classes for handling long text
      expect(textElement).toHaveClass("break-words");
      expect(textElement).toHaveClass("whitespace-pre-wrap");

      // Verify the content is preserved exactly as provided
      expect(textElement.textContent).toBe(longTextResponse);
    });
  });

  describe("Default case (unmatched question type)", () => {
    test("renders the response as plain text when the question type does not match any specific case", async () => {
      // Arrange
      const response = "This is a plain text response";
      // Using a question type that doesn't match any specific case in the switch statement
      const questionType = "CustomQuestionType" as any;

      // Act
      const result = await renderEmailResponseValue(
        response,
        questionType,
        mockTranslate as unknown as TFnType
      );

      render(result);

      // Assert
      // Check if the response text is rendered
      expect(screen.getByText(response)).toBeInTheDocument();

      // Check if the text has the expected styling classes
      const textElement = screen.getByText(response);
      expect(textElement).toHaveClass("mt-0", "break-words", "whitespace-pre-wrap", "text-sm");
    });

    test("handles array responses in the default case by rendering them as text", async () => {
      // Arrange
      const response = ["Item 1", "Item 2", "Item 3"];
      const questionType = "AnotherCustomType" as any;

      // Act
      const result = await renderEmailResponseValue(
        response,
        questionType,
        mockTranslate as unknown as TFnType
      );

      // Create a fresh container for this test to avoid conflicts with previous renders
      const container = document.createElement("div");
      render(result, { container });

      // Assert
      // Check if the text element contains all items from the response array
      const textElement = container.querySelector("p");
      expect(textElement).not.toBeNull();
      expect(textElement).toHaveClass("mt-0", "break-words", "whitespace-pre-wrap", "text-sm");

      // Verify each item is present in the text content
      response.forEach((item) => {
        expect(textElement?.textContent).toContain(item);
      });
    });
  });
});
