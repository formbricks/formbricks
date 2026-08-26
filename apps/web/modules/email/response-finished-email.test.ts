import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { sendResponseFinishedEmail } from "./index";

const {
  mockRenderResponseFinishedEmail,
  mockGetOrganizationByWorkspaceId,
  mockGetElementResponseMapping,
  mockResolveStorageUrl,
  mockGetTranslate,
  mockCreateTransport,
} = vi.hoisted(() => ({
  mockRenderResponseFinishedEmail: vi.fn(),
  mockGetOrganizationByWorkspaceId: vi.fn(),
  mockGetElementResponseMapping: vi.fn(),
  mockResolveStorageUrl: vi.fn(),
  mockGetTranslate: vi.fn(),
  mockCreateTransport: vi.fn(() => ({ sendMail: vi.fn() })),
}));

vi.mock("@formbricks/email", () => ({
  renderResponseFinishedEmail: mockRenderResponseFinishedEmail,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: mockGetOrganizationByWorkspaceId,
}));

vi.mock("@/lib/responses", () => ({
  getElementResponseMapping: mockGetElementResponseMapping,
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrl: mockResolveStorageUrl,
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: mockGetTranslate,
}));

// The real transport would try to reach the SMTP host from .env (localhost:1025, nothing listening).
// Stub it so `sendEmail`'s side effect stays a no-op; the assertions only care about the render call.
vi.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
}));

const survey = { id: "survey1", name: "Survey", variables: [], hiddenFields: {} } as unknown as TSurvey;
const response = { id: "response1", data: {}, variables: {} } as unknown as TResponse;

describe("sendResponseFinishedEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranslate.mockResolvedValue((key: string) => key);
    mockGetElementResponseMapping.mockReturnValue([]);
    mockRenderResponseFinishedEmail.mockResolvedValue("<html>rendered</html>");
    mockResolveStorageUrl.mockImplementation((url: string) => `https://cdn.example.com${url}`);
  });

  // This is the exact regression: the organization's whitelabel logo was fetched but never
  // threaded into the template, so the notification email always fell back to the hard-coded
  // Formbricks logo regardless of what the organization had configured.
  test("resolves the organization's whitelabel logo to an absolute URL", async () => {
    mockGetOrganizationByWorkspaceId.mockResolvedValue({
      id: "org1",
      whitelabel: { logoUrl: "/storage/wsp123/public/logo--fid--abc.png" },
    });

    await sendResponseFinishedEmail("owner@example.com", "en-US", "workspace1", survey, response, 1);

    expect(mockResolveStorageUrl).toHaveBeenCalledWith("/storage/wsp123/public/logo--fid--abc.png");
    expect(mockRenderResponseFinishedEmail.mock.calls[0][0].logoUrl).toBe(
      "https://cdn.example.com/storage/wsp123/public/logo--fid--abc.png"
    );
  });

  test.each([
    ["no whitelabel object", undefined],
    ["a whitelabel object with no logo", {}],
  ])("leaves the logo unset for %s, so the default Formbricks logo applies", async (_label, whitelabel) => {
    mockGetOrganizationByWorkspaceId.mockResolvedValue({ id: "org1", whitelabel });

    await sendResponseFinishedEmail("owner@example.com", "en-US", "workspace1", survey, response, 1);

    expect(mockResolveStorageUrl).not.toHaveBeenCalled();
    expect(mockRenderResponseFinishedEmail.mock.calls[0][0].logoUrl).toBeUndefined();
  });
});
