import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { hasFeedbackRecordsInDirectories } from "@/modules/ee/analysis/lib/feedback-records";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getFeedbackDataAvailability } from "./feedback-data-availability";

vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourcesWithMappings: vi.fn(),
}));
vi.mock("@/modules/ee/analysis/lib/feedback-records", () => ({
  hasFeedbackRecordsInDirectories: vi.fn(),
}));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));

const workspaceId = "ws-1";
const sources = [{ id: "src-1" }] as never;

describe("getFeedbackDataAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 'no-directory' and skips the records lookup when the workspace has no directories", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([] as never);
    vi.mocked(getFeedbackSourcesWithMappings).mockResolvedValue(sources);

    const result = await getFeedbackDataAvailability(workspaceId);

    expect(result).toEqual({ status: "no-directory", directories: [], feedbackSources: sources });
    expect(hasFeedbackRecordsInDirectories).not.toHaveBeenCalled();
  });

  test("fetches directories and sources for the given workspace in parallel", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([] as never);
    vi.mocked(getFeedbackSourcesWithMappings).mockResolvedValue(sources);

    await getFeedbackDataAvailability(workspaceId);

    expect(getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expect(getFeedbackSourcesWithMappings).toHaveBeenCalledWith(workspaceId);
  });

  test("returns 'ready' when directories exist and they contain feedback records", async () => {
    const directories = [{ id: "dir-1" }, { id: "dir-2" }] as never;
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue(directories);
    vi.mocked(getFeedbackSourcesWithMappings).mockResolvedValue(sources);
    vi.mocked(hasFeedbackRecordsInDirectories).mockResolvedValue(true);

    const result = await getFeedbackDataAvailability(workspaceId);

    expect(hasFeedbackRecordsInDirectories).toHaveBeenCalledWith(["dir-1", "dir-2"]);
    expect(result).toEqual({
      status: "ready",
      directories,
      feedbackSources: sources,
      hasFeedbackRecords: true,
    });
  });

  test("returns 'no-records' when directories exist but contain no feedback records", async () => {
    const directories = [{ id: "dir-1" }] as never;
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue(directories);
    vi.mocked(getFeedbackSourcesWithMappings).mockResolvedValue(sources);
    vi.mocked(hasFeedbackRecordsInDirectories).mockResolvedValue(false);

    const result = await getFeedbackDataAvailability(workspaceId);

    expect(result).toEqual({
      status: "no-records",
      directories,
      feedbackSources: sources,
      hasFeedbackRecords: false,
    });
  });
});
