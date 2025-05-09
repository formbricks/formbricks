// Import the actual constants module to get its type/shape for mocking
import * as constants from "@/lib/constants";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { CreateSegmentModal } from "./components/create-segment-modal";
import { SegmentsPage } from "./page";

// Mock dependencies
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
}));

vi.mock("@/modules/ee/contacts/components/contacts-secondary-navigation", () => ({
  ContactsSecondaryNavigation: vi.fn(() => <div>ContactsSecondaryNavigation</div>),
}));

vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  getContactAttributeKeys: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/segments/components/segment-table", () => ({
  SegmentTable: vi.fn(() => <div>SegmentTable</div>),
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegments: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div>{children}</div>),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ children, cta }) => (
    <div>
      PageHeader
      {cta}
      {children}
    </div>
  )),
}));

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: vi.fn(() => <div>UpgradePrompt</div>),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("./components/create-segment-modal", () => ({
  CreateSegmentModal: vi.fn(() => <div>CreateSegmentModal</div>),
}));

const mockEnvironmentId = "test-env-id";
const mockParams = { environmentId: mockEnvironmentId };
const mockSegments = [
  { id: "seg1", title: "Segment 1", isPrivate: false, filters: [], surveys: [] },
  { id: "seg2", title: "Segment 2", isPrivate: true, filters: [], surveys: [] },
  { id: "seg3", title: "Segment 3", isPrivate: false, filters: [], surveys: [] },
] as unknown as TSegment[];
const mockFilteredSegments = mockSegments.filter((s) => !s.isPrivate);
const mockContactAttributeKeys = [{ name: "email", type: "text" } as unknown as TContactAttributeKey];
const mockT = vi.fn((key) => key); // Simple mock translation function

describe("SegmentsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Explicitly set the mocked constant value before each test if needed,
    // otherwise it defaults to the value in vi.mock
    vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;

    vi.mocked(getTranslate).mockResolvedValue(mockT);
    vi.mocked(getSegments).mockResolvedValue(mockSegments);
    vi.mocked(getContactAttributeKeys).mockResolvedValue(mockContactAttributeKeys);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders segment table and create button when contacts enabled and not read-only", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isReadOnly: false } as TEnvironmentAuth);

    const promise = Promise.resolve(mockParams);
    render(await SegmentsPage({ params: promise }));

    await screen.findByText("PageHeader"); // Wait for async component to render

    expect(screen.getByText("PageHeader")).toBeInTheDocument();
    expect(screen.getByText("ContactsSecondaryNavigation")).toBeInTheDocument();
    expect(screen.getByText("CreateSegmentModal")).toBeInTheDocument();
    expect(screen.getByText("SegmentTable")).toBeInTheDocument();
    expect(screen.queryByText("UpgradePrompt")).not.toBeInTheDocument();

    expect(vi.mocked(PageHeader).mock.calls[0][0].pageTitle).toBe("Contacts");
    expect(vi.mocked(ContactsSecondaryNavigation).mock.calls[0][0].activeId).toBe("segments");
    expect(vi.mocked(ContactsSecondaryNavigation).mock.calls[0][0].environmentId).toBe(mockEnvironmentId);
    expect(vi.mocked(CreateSegmentModal).mock.calls[0][0].environmentId).toBe(mockEnvironmentId);
    expect(vi.mocked(CreateSegmentModal).mock.calls[0][0].contactAttributeKeys).toEqual(
      mockContactAttributeKeys
    );
    expect(vi.mocked(CreateSegmentModal).mock.calls[0][0].segments).toEqual(mockFilteredSegments);
    expect(vi.mocked(SegmentTable).mock.calls[0][0].segments).toEqual(mockFilteredSegments);
    expect(vi.mocked(SegmentTable).mock.calls[0][0].contactAttributeKeys).toEqual(mockContactAttributeKeys);
    expect(vi.mocked(SegmentTable).mock.calls[0][0].isContactsEnabled).toBe(true);
    expect(vi.mocked(SegmentTable).mock.calls[0][0].isReadOnly).toBe(false);
  });

  test("renders segment table without create button when contacts enabled and read-only", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isReadOnly: true } as TEnvironmentAuth);

    const promise = Promise.resolve(mockParams);
    render(await SegmentsPage({ params: promise }));

    await screen.findByText("PageHeader");

    expect(screen.getByText("PageHeader")).toBeInTheDocument();
    expect(screen.getByText("ContactsSecondaryNavigation")).toBeInTheDocument();
    expect(screen.queryByText("CreateSegmentModal")).not.toBeInTheDocument(); // CTA should be undefined
    expect(screen.getByText("SegmentTable")).toBeInTheDocument();
    expect(screen.queryByText("UpgradePrompt")).not.toBeInTheDocument();

    expect(vi.mocked(SegmentTable).mock.calls[0][0].isReadOnly).toBe(true);
  });

  test("renders upgrade prompt when contacts disabled (Cloud)", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isReadOnly: false } as TEnvironmentAuth);

    const promise = Promise.resolve(mockParams);
    render(await SegmentsPage({ params: promise }));

    await screen.findByText("PageHeader");

    expect(screen.getByText("PageHeader")).toBeInTheDocument();
    expect(screen.getByText("ContactsSecondaryNavigation")).toBeInTheDocument();
    expect(screen.queryByText("CreateSegmentModal")).not.toBeInTheDocument();
    expect(screen.queryByText("SegmentTable")).not.toBeInTheDocument();
    expect(screen.getByText("UpgradePrompt")).toBeInTheDocument();

    expect(vi.mocked(UpgradePrompt).mock.calls[0][0].title).toBe(
      "environments.segments.unlock_segments_title"
    );
    expect(vi.mocked(UpgradePrompt).mock.calls[0][0].description).toBe(
      "environments.segments.unlock_segments_description"
    );
    expect(vi.mocked(UpgradePrompt).mock.calls[0][0].buttons).toEqual([
      {
        text: "common.start_free_trial",
        href: `/environments/${mockEnvironmentId}/settings/billing`,
      },
      {
        text: "common.learn_more",
        href: `/environments/${mockEnvironmentId}/settings/billing`,
      },
    ]);
  });

  test("renders upgrade prompt when contacts disabled (Self-hosted)", async () => {
    // Modify the mocked constant for this specific test
    vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isReadOnly: false } as TEnvironmentAuth);

    const promise = Promise.resolve(mockParams);
    render(await SegmentsPage({ params: promise }));

    await screen.findByText("PageHeader");

    expect(screen.getByText("PageHeader")).toBeInTheDocument();
    expect(screen.getByText("ContactsSecondaryNavigation")).toBeInTheDocument();
    expect(screen.queryByText("CreateSegmentModal")).not.toBeInTheDocument();
    expect(screen.queryByText("SegmentTable")).not.toBeInTheDocument();
    expect(screen.getByText("UpgradePrompt")).toBeInTheDocument();

    expect(vi.mocked(UpgradePrompt).mock.calls[0][0].buttons).toEqual([
      {
        text: "common.request_trial_license",
        href: "https://formbricks.com/upgrade-self-hosting-license",
      },
      {
        text: "common.learn_more",
        href: "https://formbricks.com/learn-more-self-hosting-license",
      },
    ]);
  });

  test("throws error if getSegments returns null", async () => {
    // Change mockResolvedValue from [] to null to trigger the error condition
    vi.mocked(getSegments).mockResolvedValue(null as any);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isReadOnly: false } as TEnvironmentAuth);

    const promise = Promise.resolve(mockParams);
    await expect(SegmentsPage({ params: promise })).rejects.toThrow("Failed to fetch segments");
  });
});
