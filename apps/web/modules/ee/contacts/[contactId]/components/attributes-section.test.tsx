import { getResponsesByContactId } from "@/lib/response/service";
import { getContactAttributes } from "@/modules/ee/contacts/lib/contact-attributes";
import { getContact } from "@/modules/ee/contacts/lib/contacts";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponse } from "@formbricks/types/responses";
import { AttributesSection } from "./attributes-section";

vi.mock("@/lib/response/service", () => ({
  getResponsesByContactId: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({
  getContactAttributes: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contacts", () => ({
  getContact: vi.fn(),
}));

const mockGetTranslate = vi.fn(async () => (key: string) => key);

vi.mock("@/tolgee/server", () => ({
  getTranslate: () => mockGetTranslate(),
}));

describe("AttributesSection", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders contact attributes correctly", async () => {
    const mockContact = {
      id: "test-contact-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "test-env",
    };

    const mockAttributes = {
      email: "test@example.com",
      language: "en",
      userId: "test-user",
      name: "Test User",
    };

    const mockResponses: TResponse[] = [
      {
        id: "response1",
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "survey1",
        finished: true,
        data: {},
        meta: {},
        ttc: {},
        variables: {},
        contactAttributes: {},
        singleUseId: null,
        contact: null,
        language: null,
        tags: [],
        endingId: null,
        displayId: null,
      },
      {
        id: "response2",
        createdAt: new Date(),
        updatedAt: new Date(),
        surveyId: "survey1",
        finished: true,
        data: {},
        meta: {},
        ttc: {},
        variables: {},
        contactAttributes: {},
        singleUseId: null,
        contact: null,
        language: null,
        tags: [],
        endingId: null,
        displayId: null,
      },
    ];

    vi.mocked(getContact).mockResolvedValue(mockContact);
    vi.mocked(getContactAttributes).mockResolvedValue(mockAttributes);
    vi.mocked(getResponsesByContactId).mockResolvedValue(mockResponses);

    const { container } = render(await AttributesSection({ contactId: "test-contact-id" }));

    expect(screen.getByText("common.attributes")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("en")).toBeInTheDocument();
    expect(screen.getByText("test-user")).toBeInTheDocument();
    expect(screen.getByText("test-contact-id")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("shows not provided text when attributes are missing", async () => {
    const mockContact = {
      id: "test-contact-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "test-env",
    };

    const mockAttributes = {
      email: "",
      language: "",
      userId: "",
    };

    const mockResponses: TResponse[] = [];

    vi.mocked(getContact).mockResolvedValue(mockContact);
    vi.mocked(getContactAttributes).mockResolvedValue(mockAttributes);
    vi.mocked(getResponsesByContactId).mockResolvedValue(mockResponses);

    render(await AttributesSection({ contactId: "test-contact-id" }));

    const notProvidedElements = screen.getAllByText("environments.contacts.not_provided");
    expect(notProvidedElements).toHaveLength(3);
  });
});
